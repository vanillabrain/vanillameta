import { StudioCreationService } from './studio-creation.service';
import { StudioPublicationService } from './studio-publication.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, In } from 'typeorm';
import { StudioExecution } from './entities/studio-execution.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioService } from './studio.service';
import { StudioRunService } from './studio-run.service';
import { StudioRemixService } from './studio-remix.service';
import { studioDigest } from './studio-legacy';
import { studioKeys, validateStudioDocument } from './studio-document';
import { RemixRequest } from './studio-remix-contract';
import {
  StudioExecutionRequest,
  StudioExecutionState,
  StudioRemixSaveClaim,
  StudioRemixSaveResult,
  StudioStepId,
  StudioStepStatus,
} from './studio-execution-contract';

/** A confirmed in-conversation mapping, bound to one owned remix execution. */
type StudioRemixBinding = {
  token: string;
  request: RemixRequest;
  payloadHash: string;
  claim: StudioRemixSaveClaim;
};

@Injectable()
export class StudioExecutionService implements OnModuleInit {
  private active = new Map<string, { controller: AbortController; promise: Promise<any> }>();
  private answers = new Map<string, { answer: string; expires: number }>();
  private contexts = new Map<string, { body: StudioExecutionRequest; expires: number }>();
  private remixes = new Map<string, { payloadHash: string; promise: Promise<any> }>();
  constructor(
    private readonly db: DataSource,
    private readonly studio: StudioService,
    private readonly runs: StudioRunService,
    @Optional() private readonly publications?: StudioPublicationService,
    @Optional() private readonly remixService?: StudioRemixService,
    @Optional() private readonly creationService?: StudioCreationService,
  ) {}

  async onModuleInit() {
    await this.studio.serializeWrite(async () => {
      const rows = await this.db.manager.find(StudioExecution, {
        where: { status: In(['pending', 'running']) },
      });
      for (const row of rows) {
        const state = this.state(row);
        const committed = await this.committed(row, false);
        const published = state.publish
          ? await this.publications?.committed(this.publicationId(row), row.actorId, false)
          : undefined;
        if (published) state.publicationResult = published;
        for (const step of state.steps) {
          if (step.stepId === 'publish' && published) {
            step.status = 'succeeded';
            step.retryable = false;
            delete step.errorCode;
            step.resultRef = this.publicationId(row);
          } else if (step.stepId === 'saveDraft' && committed) {
            step.status = 'succeeded';
            step.retryable = false;
            delete step.errorCode;
            step.resultRef = this.saveId(row);
          } else if (step.status === 'running' || step.status === 'pending') {
            step.status = 'interrupted';
            step.errorCode = 'RUN_INTERRUPTED';
            step.retryable = true;
          }
        }
        row.status = state.steps.every(s => s.status === 'succeeded')
          ? 'succeeded'
          : committed && state.publish
          ? 'partial'
          : 'interrupted';
        row.state = JSON.stringify(state);
        await this.db.manager.save(StudioExecution, row);
      }
    });
  }
  private state(row: StudioExecution): StudioExecutionState {
    return JSON.parse(row.state);
  }
  private saveId(row: StudioExecution) {
    return 'execution-' + row.runId;
  }
  private publicationId(row: StudioExecution) {
    return 'publication-execution-' + row.runId;
  }
  private async committed(row: StudioExecution, serialize = true) {
    const read = async () => {
      const saved = await this.db.manager.findOne(StudioRun, {
        where: { actorId: row.actorId, requestId: this.saveId(row) },
      });
      return saved?.result ? JSON.parse(saved.result) : undefined;
    };
    // The single SQLite connection must not expose a save journal before its transaction commits.
    return serialize ? this.studio.serializeWrite(read) : read();
  }
  private async owned(runId: string, actor: number) {
    const row = await this.db.manager.findOne(StudioExecution, { where: { runId } });
    if (!row || row.actorId !== actor)
      throw new ForbiddenException('실행 기록에 접근할 수 없습니다.');
    await this.studio.assertExecutionAccess(
      row.dashboardId,
      this.state(row).request.document.sourceId,
      actor,
    );
    const receipt = this.state(row).remixSaveResult;
    if (receipt) await this.assertClone(receipt, actor);
    const created = this.state(row).creationSaveResult;
    if (created)
      await this.studio.assertExecutionAccess(created.dashboardId, created.sourceId, actor);
    return row;
  }
  private validate(body: any): asserts body is StudioExecutionRequest {
    try {
      studioKeys(body, [
        'requestId',
        'dashboardId',
        'expectedRevision',
        'expectedSourceRevision',
        'document',
        'clientEditVersion',
        'selectedBlockId',
        'prompt',
      ]);
      if (
        !Number.isSafeInteger(body.dashboardId) ||
        Number(body.dashboardId) <= 0 ||
        typeof body.requestId !== 'string' ||
        !/^[-a-zA-Z0-9_]{1,128}$/.test(body.requestId) ||
        typeof body.expectedRevision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.expectedRevision) ||
        typeof body.expectedSourceRevision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.expectedSourceRevision) ||
        !Number.isSafeInteger(body.clientEditVersion) ||
        Number(body.clientEditVersion) < 0 ||
        typeof body.prompt !== 'string' ||
        !body.prompt.trim() ||
        body.prompt.length > 2000
      )
        throw new Error();
      const document = validateStudioDocument(body.document);
      if (
        document.dashboardId !== body.dashboardId ||
        (document.revision !== undefined && document.revision !== body.expectedRevision) ||
        !document.blocks.length ||
        (body.selectedBlockId !== undefined &&
          !document.blocks.some(b => b.id === body.selectedBlockId))
      )
        throw new Error();
    } catch {
      throw new BadRequestException('실행 요청과 선택 블록을 확인해 주세요.');
    }
  }
  /** Only explicit, bounded commands authorize persistence or publication. */
  protected plan(
    body: StudioExecutionRequest,
  ): Pick<
    StudioExecutionState,
    'save' | 'saveOnly' | 'unsupported' | 'publish' | 'remix' | 'remixToken' | 'create'
  > {
    const prompt = body.prompt.trim();
    // This intent prepares a read-only handoff. Mapping and creation still require
    // explicit confirmation in the existing recipient-owned remix screen.
    const remixCommand = prompt.match(
      /^(?:(?:(?:이|현재)\s*(?:대시보드|게시본)(?:을|를)?\s*)?내\s*데이터로\s*복제\s*(?:해\s*줘|해\s*주세요|해주세요)|remix\s+(?:this\s+dashboard\s+)?with\s+my\s+data)[.!。]?(?:\s+((?:https?:\/\/[^\s/?#]+)?\/published\/([a-f0-9]{64})))?$/iu,
    );
    if (remixCommand)
      return {
        save: false,
        saveOnly: true,
        remix: true,
        ...(remixCommand[2] ? { remixToken: remixCommand[2] } : {}),
      };
    // Exact, explicit link consent only. Ambiguous/negative sharing never becomes a public write.
    if (
      /^(?:현재\s*)?(?:초안(?:을)?\s*)?저장하고\s*링크로\s*공유\s*(?:해\s*줘|해\s*주세요|해주세요)[.!。]?$/u.test(
        prompt,
      ) ||
      /^save(?: draft)? and share (?:a |the )?link[.!]?$/i.test(prompt)
    )
      return { save: true, saveOnly: true, publish: true };
    // Remove only explicitly prohibited publication clauses before unsupported-intent
    // detection. This never authorizes publication: the exact consent gate stays above,
    // and any remaining positive/ambiguous publication mention is still rejected.
    const withoutNegativePublication = prompt
      .replace(
        /(?:게시|공유|퍼블리시)(?:\s*(?:하거나|나|또는|및|와|과)\s*(?:게시|공유|퍼블리시))*(?:은|는|을|를)?\s*(?:하지(?:는)?\s*(?:마(?:세요|라|줘)?|말(?:아(?:줘|주세요)?)?)|안\s*(?:해|하기)|금지)/gu,
        '',
      )
      .replace(
        /(?:do\s+not|don['’]?t|never)\s+(?:publish|share)(?:\s+(?:or|and)\s+(?:publish|share))?/gi,
        '',
      )
      .replace(/without\s+(?:publishing|sharing)(?:\s+(?:or|and)\s+(?:publishing|sharing))?/gi, '');
    const newDashboard =
      /^(?:만들어\s*줘|생성해\s*줘)[.!。]?$|(?:새|새로운)\s*대시보드|대시보드(?:를)?\s*(?:만들|생성)|create\s+(?:a\s+)?dashboard/i.test(
        prompt,
      );
    const prohibitCreation =
      /생성\s*(?:하지\s*마|금지)|만들(?:지\s*마|기\s*금지)|(?:do\s+not|don['’]?t|never)\s+create/i.test(
        prompt,
      );
    if (
      newDashboard &&
      !prohibitCreation &&
      !/게시|공유|퍼블리시|publish|share|복제|리믹스|remix|duplicate/i.test(
        withoutNegativePublication,
      )
    )
      return { save: false, saveOnly: false, create: true };
    if (
      /게시|공유|퍼블리시|publish|share/i.test(prompt) &&
      (/게시|공유|퍼블리시|publish|share/i.test(withoutNegativePublication) ||
        !/바꾸|바꿔|변경|수정|rename|edit|change|update/i.test(withoutNegativePublication))
    )
      return { save: false, saveOnly: false, unsupported: 'publish' };
    if (/복제|리믹스|remix|duplicate/i.test(prompt))
      return { save: false, saveOnly: false, unsupported: 'remix' };
    if (newDashboard) return { save: false, saveOnly: false, unsupported: 'proposeSemantics' };
    const saveOnly =
      /^(?:현재\s*)?(?:초안(?:을)?\s*)?저장\s*(?:해\s*줘|해\s*주세요|해주세요|해|하기)?[.!。]?$/u.test(
        prompt,
      ) || /^(?:save|save draft)[.!]?$/i.test(prompt);
    const negative =
      /저장\s*(?:하지|하지는|안|말|금지)|저장하지|don['’]?t\s+save|do\s+not\s+save|without\s+sav/i.test(
        prompt,
      );
    // A later preservation clause must not hide explicit consent in an earlier
    // sentence. Quoted labels/examples are data, and any negative save still wins.
    const commands = prompt
      .replace(/"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’|`[^`]*`/gu, '')
      .split(/[.!。;\n]+/u);
    const save =
      saveOnly ||
      (!negative &&
        commands.some(command =>
          /(?:하고|고|후|뒤|다음|,|그리고)\s*저장\s*(?:해\s*줘|해\s*주세요|해주세요)$/u.test(
            command.trim(),
          ),
        ));
    return { save, saveOnly };
  }
  protected stepIds(
    plan: Pick<
      StudioExecutionState,
      'save' | 'saveOnly' | 'unsupported' | 'publish' | 'remix' | 'remixToken' | 'create'
    >,
  ): StudioStepId[] {
    const ids: StudioStepId[] = ['inspectSource'];
    if (plan.remix) return [...ids, 'remix'];
    if (plan.create) return [...ids, 'createProposal'];
    if (plan.unsupported) ids.push(plan.unsupported);
    else if (!plan.saveOnly) ids.push('proposeSemantics', 'preview', 'applyDraft');
    if (plan.save) ids.push('saveDraft');
    if (plan.publish) ids.push('publish');
    return ids;
  }
  async create(body: any, actor: number, signal?: AbortSignal) {
    this.validate(body);
    this.checkDisconnected(signal);
    await this.studio.assertExecutionAccess(body.dashboardId, body.document.sourceId, actor);
    this.checkDisconnected(signal);
    const hash = studioDigest(body);
    const row = await this.studio.serializeWrite(async () => {
      this.checkDisconnected(signal);
      const prior = await this.db.manager.findOne(StudioExecution, {
        where: { actorId: actor, requestId: body.requestId },
      });
      if (prior) {
        if (prior.payloadHash !== hash)
          throw new ConflictException('같은 실행 ID에 다른 요청을 보낼 수 없습니다.');
        return { row: prior, fresh: false };
      }
      const plan = this.plan(body);
      const ids = this.stepIds(plan);
      const request = {
        requestId: body.requestId,
        dashboardId: body.dashboardId,
        expectedRevision: body.expectedRevision,
        expectedSourceRevision: body.expectedSourceRevision,
        document: body.document,
        clientEditVersion: body.clientEditVersion,
        ...(body.selectedBlockId === undefined ? {} : { selectedBlockId: body.selectedBlockId }),
      };
      const state: StudioExecutionState = {
        request,
        ...plan,
        steps: ids.map(stepId => ({ stepId, status: 'pending', retryable: false })),
      };
      const entity = await this.db.manager.save(StudioExecution, {
        runId: randomUUID(),
        actorId: actor,
        dashboardId: body.dashboardId,
        requestId: body.requestId,
        payloadHash: hash,
        status: 'pending',
        state: JSON.stringify(state),
      });
      return { row: entity, fresh: true };
    });
    if (!row.fresh) return this.get(row.row.runId, actor);
    this.remember(row.row.runId, body);
    return this.launch(row.row, body, signal);
  }
  private remember(id: string, body: StudioExecutionRequest) {
    for (const [key, value] of this.contexts)
      if (value.expires < Date.now()) this.contexts.delete(key);
    if (this.contexts.size >= 64) this.contexts.delete(this.contexts.keys().next().value);
    this.contexts.set(id, { body: JSON.parse(JSON.stringify(body)), expires: Date.now() + 600000 });
  }
  private context(id: string) {
    const entry = this.contexts.get(id);
    if (entry?.expires > Date.now()) return entry.body;
    this.contexts.delete(id);
    return undefined;
  }
  private summary(row: StudioExecution) {
    const state = this.state(row),
      b = state.request;
    const baseDocument = { ...b.document };
    delete baseDocument.revision;
    return {
      runId: row.runId,
      requestId: row.requestId,
      dashboardId: row.dashboardId,
      status: row.status,
      steps: state.steps,
      ...(state.publicationResult ? { publicationResult: state.publicationResult } : {}),
      ...(row.status === 'succeeded' && state.remixResult
        ? { remixResult: state.remixResult }
        : {}),
      ...(state.remixSaveResult ? { remixSaveResult: state.remixSaveResult } : {}),
      ...(state.creationResult ? { creationResult: state.creationResult } : {}),
      ...(state.creationSaveResult ? { creationSaveResult: state.creationSaveResult } : {}),
      baseRevision: b.expectedRevision,
      baseDocumentHash: studioDigest(baseDocument),
      sourceRevision: b.expectedSourceRevision,
      clientEditVersion: b.clientEditVersion,
      selectedBlockId: b.selectedBlockId ?? null,
      requiresRequest:
        row.status !== 'cancelled' &&
        !state.saveOnly &&
        !state.unsupported &&
        !state.proposal &&
        !this.context(row.runId),
      answer:
        row.status === 'succeeded'
          ? state.remixResult
            ? state.remixSaveResult
              ? '내 데이터로 비공개 복제본을 만들었습니다. 복제본 대시보드에서 확인해 주세요. 현재 편집은 유지했습니다.'
              : '복제 준비가 완료되었습니다. 내 데이터와 열 매핑을 확인해 주세요. 아직 복제본은 저장되지 않았습니다.'
            : state.publish
            ? '초안을 저장하고 링크로 공유했습니다.'
            : state.save
            ? '초안을 저장했습니다.'
            : '검증한 결과를 확인해 주세요.'
          : row.status === 'unsupported'
          ? '요청한 작업은 아직 지원하지 않습니다. 공유 범위를 확인해 주세요.'
          : '실행 단계와 재시도 가능 여부를 확인해 주세요.',
    };
  }
  async list(dashboardId: number, actor: number) {
    if (!Number.isSafeInteger(dashboardId) || dashboardId <= 0)
      throw new BadRequestException('대시보드를 확인해 주세요.');
    const rows = await this.db.manager.find(StudioExecution, {
      where: { dashboardId, actorId: actor },
      order: { createdAt: 'DESC', runId: 'DESC' },
      take: 20,
    });
    // Even an empty list must authorize the current dashboard.
    if (!rows.length) {
      const current = await this.studio.get(dashboardId, actor);
      await this.studio.assertExecutionAccess(dashboardId, current.document.sourceId, actor);
    }
    for (const row of rows) {
      await this.owned(row.runId, actor);
      // A committed clone is surfaced from its durable receipt even if the response was lost.
      await this.recoverRemix(row, this.state(row), actor);
      await this.recoverCreation(row, actor);
    }
    return rows.map(row => this.summary(row));
  }
  async get(runId: string, actor: number): Promise<any> {
    const row = await this.owned(runId, actor),
      state = this.state(row);
    await this.recoverRemix(row, state, actor);
    await this.recoverCreation(row, actor);
    const response: any = this.summary(row);
    const saveResult = await this.committed(row);
    if (saveResult) response.saveResult = saveResult;
    if (state.publish) {
      const publication = await this.publications?.committed(this.publicationId(row), actor);
      if (publication) response.publicationResult = publication;
    }
    if (state.proposal && state.steps.find(s => s.stepId === 'preview')?.status === 'succeeded') {
      try {
        const document = saveResult?.document ?? state.proposal.document;
        const checked = await this.studio.prepare(
          row.dashboardId,
          {
            ...state.request,
            expectedRevision: document.revision ?? state.request.expectedRevision,
            document,
          },
          actor,
        );
        response.result = this.result(row, state, checked.preview);
      } catch (error) {
        // Never leak preview/provider details or turn read-only recovery into an execution.
        if ([401, 403].includes(error?.getStatus?.())) throw error;
      }
    }
    return response;
  }
  private result(row: StudioExecution, state: StudioExecutionState, preview: any) {
    const b = state.request;
    return {
      runId: row.runId,
      baseRevision: b.expectedRevision,
      sourceRevision: b.expectedSourceRevision,
      clientEditVersion: b.clientEditVersion,
      selectedBlockId: b.selectedBlockId ?? null,
      intent: state.proposal.intent,
      answer:
        this.liveAnswer(row.runId) ??
        (state.proposal.intent === 'ask'
          ? '답변 본문은 보관하지 않습니다. 다시 질문해 주세요.'
          : '검증한 변경안을 확인해 주세요.'),
      proposedOperations: state.proposal.operations,
      preview,
      steps: [
        { name: '문맥 확인', status: 'succeeded' },
        { name: 'AI 응답', status: 'succeeded' },
        { name: '변경 검증', status: 'succeeded' },
      ],
    };
  }
  async retry(id: string, body: any, actor: number, signal?: AbortSignal) {
    this.checkDisconnected(signal);
    const row = await this.owned(id, actor),
      state = this.state(row);
    this.checkDisconnected(signal);
    try {
      studioKeys(body, ['stepId', 'request']);
    } catch {
      throw new BadRequestException('재시도 요청을 확인해 주세요.');
    }
    if (body.request !== undefined) {
      this.validate(body.request);
      if (studioDigest(body.request) !== row.payloadHash)
        throw new ConflictException('원래 요청과 편집 버전이 다릅니다. 새 요청으로 실행해 주세요.');
      this.remember(id, body.request);
    }
    const target = state.steps.find(s => s.stepId === body.stepId);
    if (!target || !target.retryable || !['failed', 'interrupted'].includes(target.status))
      throw new ConflictException('실패하거나 중단한 단계만 재시도할 수 있습니다.');
    if (
      target.stepId === 'publish' &&
      this.publications &&
      state.publicationBasis === undefined &&
      !(await this.publications?.committed(this.publicationId(row), actor))
    )
      throw new ConflictException(
        '이전 실행의 게시 기준이 없습니다. 최신 공개 범위를 확인하고 새 요청으로 게시해 주세요.',
      );
    if (this.active.has(id)) throw new ConflictException('실행이 진행 중입니다.');
    if (!state.saveOnly && !state.proposal && !this.context(id)) return this.get(id, actor);
    const earlier = state.steps.slice(0, state.steps.indexOf(target));
    if (earlier.some(s => s.status !== 'succeeded'))
      throw new ConflictException('앞선 실패 단계부터 재시도해 주세요.');
    return this.launch(row, this.context(id), signal);
  }
  async cancel(id: string, actor: number) {
    const row = await this.owned(id, actor);
    this.active.get(id)?.controller.abort();
    if (this.active.has(id)) {
      try {
        await this.active.get(id).promise;
      } catch {
        /* get returns the durable outcome */
      }
    } else if (!['succeeded', 'unsupported', 'cancelled'].includes(row.status)) {
      const state = this.state(row);
      const saved = await this.committed(row);
      const published = state.publish
        ? await this.publications?.committed(this.publicationId(row), actor)
        : undefined;
      if (published) state.publicationResult = published;
      for (const step of state.steps) {
        if ((step.stepId === 'saveDraft' && saved) || (step.stepId === 'publish' && published)) {
          step.status = 'succeeded';
          step.retryable = false;
          delete step.errorCode;
          step.resultRef = step.stepId === 'saveDraft' ? this.saveId(row) : this.publicationId(row);
        } else if (step.status !== 'succeeded') {
          step.status = 'cancelled';
          step.retryable = false;
          step.errorCode = 'RUN_CANCELLED';
        }
      }
      row.status = state.steps.every(s => s.status === 'succeeded')
        ? 'succeeded'
        : saved
        ? 'partial'
        : 'cancelled';
      await this.persist(row, state);
    }
    return this.get(id, actor);
  }
  /**
   * T14: explicit column mapping confirmation in the conversation. The publication token and
   * version stay bound to the owned remix run and one private clone is written per execution.
   */
  async remix(runId: string, body: any, actor: number): Promise<any> {
    const row = await this.owned(runId, actor),
      state = this.state(row),
      binding = this.remixBinding(row, state, body);
    if (!this.remixService)
      throw new ServiceUnavailableException('복제 저장을 사용할 수 없습니다.');
    if (state.remixSaveResult) {
      if (state.remixSave?.payloadHash !== binding.payloadHash)
        throw new ConflictException(
          '이 실행에는 다른 복제 내용이 이미 저장되었습니다. 새 요청으로 실행해 주세요.',
        );
      // A stored receipt is only returned while the actor still owns the clone and its source.
      await this.assertClone(state.remixSaveResult, actor);
      return this.get(runId, actor);
    }
    const pending = this.remixes.get(runId);
    if (pending) {
      if (pending.payloadHash !== binding.payloadHash)
        throw new ConflictException('복제 저장이 진행 중입니다. 같은 요청으로 다시 시도해 주세요.');
      return pending.promise;
    }
    const promise = this.saveRemix(row, state, actor, binding).finally(() =>
      this.remixes.delete(runId),
    );
    this.remixes.set(runId, { payloadHash: binding.payloadHash, promise });
    return promise;
  }
  /** The remix identity is deterministic per run, so a repeated submit can never add a clone. */
  private remixRequestId(row: StudioExecution) {
    return 'execution-' + row.runId + '-remix';
  }
  /** Validates the confirmed mapping and binds the run's own publication token and version. */
  private remixBinding(
    row: StudioExecution,
    state: StudioExecutionState,
    body: any,
  ): StudioRemixBinding {
    try {
      studioKeys(body, [
        'requestId',
        'targetSourceId',
        'mapping',
        'excludedBlockIds',
        'expectedVersion',
        'expectedSourceRevision',
      ]);
      if (
        typeof body.requestId !== 'string' ||
        !/^[-a-zA-Z0-9_]{1,128}$/.test(body.requestId) ||
        !Number.isSafeInteger(body.targetSourceId) ||
        Number(body.targetSourceId) <= 0 ||
        !body.mapping ||
        typeof body.mapping !== 'object' ||
        Array.isArray(body.mapping) ||
        Object.keys(body.mapping).length > 128 ||
        Object.entries(body.mapping).some(
          ([key, value]) =>
            !key ||
            key.length > 256 ||
            ['__proto__', 'constructor', 'prototype'].includes(key) ||
            typeof value !== 'string' ||
            value.length > 256,
        ) ||
        (body.excludedBlockIds !== undefined &&
          (!Array.isArray(body.excludedBlockIds) ||
            body.excludedBlockIds.length > 6 ||
            new Set(body.excludedBlockIds).size !== body.excludedBlockIds.length ||
            body.excludedBlockIds.some(id => typeof id !== 'string'))) ||
        !Number.isSafeInteger(body.expectedVersion) ||
        Number(body.expectedVersion) < 1 ||
        typeof body.expectedSourceRevision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.expectedSourceRevision)
      )
        throw new Error();
    } catch {
      throw new BadRequestException('복제할 열 매핑과 대상 소스를 확인해 주세요.');
    }
    if (
      !state.remix ||
      !state.remixResult ||
      row.status !== 'succeeded' ||
      !state.steps.some(step => step.stepId === 'remix' && step.status === 'succeeded')
    )
      throw new ConflictException(
        '복제 준비가 끝난 실행에서만 비공개 복제본을 저장할 수 있습니다.',
      );
    if (body.expectedVersion !== state.remixResult.version)
      throw new ConflictException('게시 버전이 변경되었습니다. 실행 기록을 새로 확인해 주세요.');
    const mapping = body.mapping as Record<string, string>;
    // Never the body: the published token and version are the ones this run was prepared with.
    const token = state.remixResult.token;
    const request: RemixRequest = {
      requestId: this.remixRequestId(row),
      targetSourceId: Number(body.targetSourceId),
      mapping: { ...mapping },
      excludedBlockIds:
        body.excludedBlockIds === undefined ? [] : [...(body.excludedBlockIds as string[])],
      expectedVersion: state.remixResult.version,
      expectedSourceRevision: body.expectedSourceRevision as string,
    };
    const payloadHash = studioDigest({ token, ...request });
    return {
      token,
      request,
      payloadHash,
      claim: {
        requestId: request.requestId,
        payloadHash,
        targetSourceId: request.targetSourceId,
        expectedSourceRevision: request.expectedSourceRevision,
        expectedVersion: request.expectedVersion,
      },
    };
  }
  /** One private clone per execution: the durable claim precedes the remix write. */
  private async saveRemix(
    row: StudioExecution,
    state: StudioExecutionState,
    actor: number,
    binding: StudioRemixBinding,
  ) {
    const prior = state.remixSave;
    if (prior && prior.payloadHash !== binding.payloadHash) {
      // A committed clone can never be re-mapped; an uncommitted claim is replaced by the
      // corrected confirmation instead of poisoning this execution.
      const receipt = await this.remixService.receipt(actor, prior.requestId, prior.targetSourceId);
      if (receipt)
        throw new ConflictException(
          '이 실행의 복제본이 이미 저장되었습니다. 새 요청으로 실행해 주세요.',
        );
      delete state.remixSave;
    }
    if (!state.remixSave) {
      state.remixSave = binding.claim;
      await this.persist(row, state);
    }
    // Recheck the original dashboard/source; the remix service rechecks the bound publication.
    await this.studio.assertExecutionAccess(
      row.dashboardId,
      state.request.document.sourceId,
      actor,
    );
    let result: any;
    try {
      result = await this.remixService.remix(binding.token, binding.request, actor);
    } catch (error) {
      await this.failedRemix(row, state, actor, binding, error);
      throw error;
    }
    state.remixSaveResult = this.cloneResult(
      row,
      binding.request.targetSourceId,
      binding.request.expectedVersion,
      { dashboardId: result?.dashboardId, revision: result?.document?.revision },
    );
    await this.persist(row, state);
    await this.assertClone(state.remixSaveResult, actor);
    return this.get(row.runId, actor);
  }
  /** A proven safe refusal releases the claim; an uncertain outcome stays pinned for a retry. */
  private async failedRemix(
    row: StudioExecution,
    state: StudioExecutionState,
    actor: number,
    binding: StudioRemixBinding,
    error: any,
  ) {
    const status = error?.getStatus?.();
    if (!status || status >= 500) return;
    let receipt: Awaited<ReturnType<StudioRemixService['receipt']>>;
    try {
      receipt = await this.remixService.receipt(
        actor,
        binding.request.requestId,
        binding.request.targetSourceId,
      );
    } catch {
      return; // An inaccessible journal is not proof that no write committed.
    }
    if (receipt || state.remixSave?.payloadHash !== binding.payloadHash) return;
    delete state.remixSave;
    await this.persist(row, state);
  }
  private cloneResult(
    row: StudioExecution,
    sourceId: number,
    version: number,
    receipt: { dashboardId: number; revision: string },
  ): StudioRemixSaveResult {
    if (
      !Number.isSafeInteger(receipt?.dashboardId) ||
      receipt.dashboardId <= 0 ||
      receipt.dashboardId === row.dashboardId ||
      typeof receipt?.revision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(receipt.revision)
    )
      throw new ConflictException('복제 완료 기록을 확인해 주세요.');
    return { dashboardId: receipt.dashboardId, sourceId, revision: receipt.revision, version };
  }
  private assertClone(result: StudioRemixSaveResult, actor: number) {
    return this.studio.assertExecutionAccess(result.dashboardId, result.sourceId, actor);
  }
  /** Read-path receipt recovery; it never fails a read and never returns an unverified receipt. */
  private async recoverRemix(row: StudioExecution, state: StudioExecutionState, actor: number) {
    try {
      if (!state.remixSave || state.remixSaveResult || !state.remixResult || !this.remixService)
        return;
      const receipt = await this.remixService.receipt(
        actor,
        state.remixSave.requestId,
        state.remixSave.targetSourceId,
      );
      if (!receipt || receipt.payloadHash !== state.remixSave.payloadHash) return;
      const recovered = this.cloneResult(
        row,
        receipt.sourceId,
        state.remixSave.expectedVersion,
        receipt,
      );
      await this.assertClone(recovered, actor);
      state.remixSaveResult = recovered;
      await this.persist(row, state);
    } catch {
      // Best effort: a stale or unverifiable receipt is reported as absent, never as a failed read.
    }
  }
  private creationBody(row: StudioExecution, state = this.state(row)) {
    if (
      row.status !== 'succeeded' ||
      !state.create ||
      !state.creationResult ||
      !this.creationService
    )
      throw new ConflictException('신규 생성 제안이 완료된 실행을 확인해 주세요.');
    return {
      requestId: 'execution-' + row.runId + '-create',
      proposalId: state.creationResult.proposalId,
      expectedSourceRevision: state.creationResult.sourceRevision,
    };
  }
  async creationProposal(id: string, actor: number) {
    const row = await this.owned(id, actor),
      state = this.state(row);
    this.creationBody(row, state);
    return this.creationService.proposal(
      state.creationResult.proposalId,
      state.creationResult.sourceId,
      actor,
    );
  }
  async saveCreation(id: string, body: any, actor: number) {
    try {
      studioKeys(body, ['proposalId', 'expectedSourceRevision']);
    } catch {
      throw new BadRequestException('생성 확인 요청을 확인해 주세요.');
    }
    const row = await this.owned(id, actor),
      state = this.state(row);
    const pinned = this.creationBody(row, state);
    if (
      body.proposalId !== pinned.proposalId ||
      body.expectedSourceRevision !== pinned.expectedSourceRevision
    )
      throw new ConflictException('이 실행에서 확인한 생성안과 다릅니다.');
    // Existing compiler owns transactions, source revalidation and idempotency. No current draft write.
    await this.creationService.create(pinned, actor);
    return this.get(id, actor);
  }
  private async recoverCreation(row: StudioExecution, actor: number) {
    const state = this.state(row);
    if (!state.creationResult || state.creationSaveResult || row.status !== 'succeeded') return;
    const result = await this.creationService?.receipt(this.creationBody(row, state), actor);
    if (!result) return;
    if (
      result.dashboardId === row.dashboardId ||
      result.document.sourceId !== state.creationResult.sourceId
    )
      throw new ConflictException('신규 대시보드 저장 기록이 다릅니다.');
    state.creationSaveResult = {
      dashboardId: result.dashboardId,
      sourceId: result.document.sourceId,
      revision: result.document.revision,
    };
    await this.persist(row, state);
  }
  private persist(row: StudioExecution, state: StudioExecutionState) {
    row.state = JSON.stringify(state);
    return this.studio.serializeWrite(() => this.db.manager.save(StudioExecution, row));
  }
  private checkDisconnected(signal?: AbortSignal) {
    if (signal?.aborted) throw new BadRequestException('실행 요청을 취소했습니다.');
  }
  private rememberAnswer(id: string, answer: string) {
    for (const [key, value] of this.answers)
      if (value.expires < Date.now()) this.answers.delete(key);
    if (this.answers.size >= 64) this.answers.delete(this.answers.keys().next().value);
    this.answers.set(id, { answer, expires: Date.now() + 600000 });
  }
  private liveAnswer(id: string) {
    const entry = this.answers.get(id);
    if (entry?.expires > Date.now()) return entry.answer;
    this.answers.delete(id);
    return undefined;
  }
  private launch(row: StudioExecution, body?: StudioExecutionRequest, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    // Install the latch before executing any stage; GET/list remain available during model awaits.
    const promise = Promise.resolve()
      .then(() => this.execute(row, body, controller.signal))
      .finally(() => {
        signal?.removeEventListener('abort', abort);
        this.active.delete(row.runId);
        if (['succeeded', 'cancelled', 'unsupported'].includes(row.status))
          this.contexts.delete(row.runId);
      });
    this.active.set(row.runId, { controller, promise });
    return promise;
  }
  /** Publication writes use a journal; remix only prepares an authorized handoff. */
  protected async externalStep(
    stepId: StudioStepId,
    row?: StudioExecution,
    signal?: AbortSignal,
  ): Promise<StudioStepStatus> {
    if (stepId === 'publish' && row && this.state(row).publish) {
      if (!this.publications) throw new Error('PUBLICATION_UNAVAILABLE');
      const saved = await this.committed(row);
      if (!saved?.document?.revision) throw new Error('SAVED_REVISION_REQUIRED');
      await this.publications.publish(
        row.dashboardId,
        {
          requestId: this.publicationId(row),
          expectedRevision: saved.document.revision,
          visibility: 'link',
          allowRemix: false,
        },
        row.actorId,
        signal,
        this.state(row).publicationBasis,
      );
      return 'succeeded';
    }
    switch (stepId) {
      default:
        return 'unsupported';
    }
  }
  private async execute(
    row: StudioExecution,
    body: StudioExecutionRequest | undefined,
    signal: AbortSignal,
  ) {
    const state = this.state(row);
    let prepared: any, preview: any;
    const request = state.request;
    row.status = 'running';
    for (const step of state.steps) {
      if (step.status === 'succeeded') continue;
      if (signal.aborted) {
        step.status = 'cancelled';
        step.retryable = false;
        row.status = 'cancelled';
        break;
      }
      step.status = 'running';
      step.retryable = false;
      delete step.errorCode;
      await this.persist(row, state);
      try {
        await this.studio.assertExecutionAccess(
          row.dashboardId,
          request.document.sourceId,
          row.actorId,
        );
        if (step.stepId === 'inspectSource') {
          // A recipient handoff must not aggregate or expose the unrelated editing source.
          if (!state.remix && !state.create)
            prepared = await this.studio.prepare(row.dashboardId, request, row.actorId);
        } else if (step.stepId === 'createProposal' && state.create) {
          if (!body || !this.creationService) throw new Error('REQUEST_REQUIRED');
          const proposal = await this.creationService.propose(
            {
              sourceId: request.document.sourceId,
              prompt: body.prompt,
              expectedFileRevision: request.expectedSourceRevision,
            },
            row.actorId,
            signal,
          );
          state.creationResult = {
            proposalId: proposal.proposalId,
            sourceId: proposal.sourceId,
            sourceRevision: proposal.sourceRevision,
          };
        } else if (step.stepId === 'remix' && state.remix) {
          if (!this.publications) throw new Error('PUBLICATION_UNAVAILABLE');
          const token =
            state.remixToken ??
            (await this.publications.ownerMetadata(row.dashboardId, row.actorId))?.token;
          if (!token) throw new Error('PUBLICATION_REQUIRED');
          const publication = await this.studio.serializeWrite(() =>
            this.publications.requireRemix(token, row.actorId),
          );
          // No source configuration, template, server URL or new dashboard is returned.
          state.remixResult = { token: publication.token, version: publication.version };
        } else if (state.unsupported === step.stepId)
          step.status = await this.externalStep(step.stepId, row, signal);
        else if (step.stepId === 'proposeSemantics') {
          if (!body) throw new Error('REQUEST_REQUIRED');
          prepared ??= await this.studio.prepare(row.dashboardId, request, row.actorId);
          const modelBody = state.save
            ? {
                ...body,
                prompt: body.prompt.replace(
                  /(?:하고|고|후|뒤|다음|,|그리고)\s*저장\s*(?:해\s*줘|해\s*주세요|해주세요)[.!。]?$/u,
                  '',
                ),
              }
            : body;
          const proposal = await this.runs.propose(modelBody, prepared, signal);
          this.rememberAnswer(row.runId, String(proposal.answer));
          // Deliberately omit free-form model answer from durable history.
          state.proposal = {
            intent: String(proposal.intent),
            operations: proposal.operations,
            document: proposal.document,
          };
          if (proposal.intent === 'unsupported') step.status = 'unsupported';
        } else if (step.stepId === 'preview') {
          preview = (
            await this.studio.prepare(
              row.dashboardId,
              { ...request, document: state.proposal.document },
              row.actorId,
            )
          ).preview;
        } else if (
          step.stepId === 'saveDraft' &&
          !state.saveOnly &&
          state.proposal?.intent !== 'edit'
        ) {
          step.status = 'unsupported';
        } else if (step.stepId === 'saveDraft') {
          const committed = await this.committed(row);
          if (!committed)
            await this.studio.save(
              row.dashboardId,
              {
                requestId: this.saveId(row),
                expectedRevision: request.expectedRevision,
                expectedSourceRevision: request.expectedSourceRevision,
                document: state.proposal?.document ?? request.document,
              },
              row.actorId,
              signal,
            );
        } else if (step.stepId === 'publish' || step.stepId === 'remix') {
          if (
            step.stepId === 'publish' &&
            state.publish &&
            state.publicationBasis === undefined &&
            this.publications
          ) {
            const current = await this.publications.ownerMetadata(row.dashboardId, row.actorId);
            state.publicationBasis = current
              ? { token: current.token, version: current.version }
              : null;
            await this.persist(row, state);
          }
          step.status = await this.externalStep(step.stepId, row, signal);
        }
        if (step.stepId === 'publish' && state.publish) {
          const published = await this.publications?.committed(
            this.publicationId(row),
            row.actorId,
          );
          if (published) state.publicationResult = published;
        }
        if (signal.aborted && !(await this.committed(row))) {
          step.status = 'cancelled';
          row.status = 'cancelled';
          break;
        }
        if (step.status === 'running') step.status = 'succeeded';
        if (step.status === 'succeeded')
          step.resultRef =
            step.stepId === 'saveDraft'
              ? this.saveId(row)
              : step.stepId === 'publish' && state.publish
              ? this.publicationId(row)
              : row.runId + ':' + step.stepId;
        if (step.status === 'unsupported') {
          step.errorCode = 'STEP_UNSUPPORTED';
          row.status = 'unsupported';
          break;
        }
        await this.persist(row, state);
      } catch (error) {
        const published =
          step.stepId === 'publish' && state.publish
            ? await this.publications?.committed(this.publicationId(row), row.actorId)
            : undefined;
        if (published) {
          state.publicationResult = published;
          step.status = 'succeeded';
          step.retryable = false;
          step.resultRef = this.publicationId(row);
          continue;
        }
        const committed = await this.committed(row);
        if (step.stepId === 'saveDraft' && committed) {
          step.status = 'succeeded';
          step.resultRef = this.saveId(row);
          continue;
        }
        step.status = signal.aborted ? 'cancelled' : 'failed';
        step.retryable = !signal.aborted;
        step.errorCode = signal.aborted
          ? 'RUN_CANCELLED'
          : step.stepId === 'proposeSemantics' || step.stepId === 'createProposal'
          ? 'MODEL_FAILED'
          : step.stepId === 'preview'
          ? 'PREVIEW_FAILED'
          : step.stepId === 'saveDraft'
          ? 'SAVE_FAILED'
          : step.stepId === 'publish'
          ? 'PUBLISH_FAILED'
          : step.stepId === 'remix'
          ? 'REMIX_UNAVAILABLE'
          : 'STEP_FAILED';
        row.status = committed && step.stepId === 'publish' ? 'partial' : step.status;
        await this.persist(row, state);
        if (
          (step.stepId !== 'remix' && [401, 403, 409].includes(error?.getStatus?.())) ||
          (error?.getStatus?.() === 400 && step.stepId === 'inspectSource')
        )
          throw error;
        break;
      }
    }
    if (state.steps.every(s => s.status === 'succeeded')) row.status = 'succeeded';
    if (row.status === 'cancelled' && state.publish && (await this.committed(row)))
      row.status = 'partial';
    if (row.status === 'cancelled' || (row.status === 'partial' && signal.aborted))
      state.steps.forEach(s => {
        if (s.status === 'pending' || s.status === 'interrupted') {
          s.status = 'cancelled';
          s.retryable = false;
        }
      });
    await this.persist(row, state);
    const response = await this.get(row.runId, row.actorId);
    if (preview && state.proposal) response.result = this.result(row, state, preview);
    return response;
  }
}
