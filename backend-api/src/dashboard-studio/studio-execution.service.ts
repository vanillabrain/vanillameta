import { StudioPublicationService } from './studio-publication.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, In } from 'typeorm';
import { StudioExecution } from './entities/studio-execution.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioService } from './studio.service';
import { StudioRunService } from './studio-run.service';
import { studioDigest } from './studio-legacy';
import { studioKeys, validateStudioDocument } from './studio-document';
import {
  StudioExecutionRequest,
  StudioExecutionState,
  StudioStepId,
  StudioStepStatus,
} from './studio-execution-contract';

@Injectable()
export class StudioExecutionService implements OnModuleInit {
  private active = new Map<string, { controller: AbortController; promise: Promise<any> }>();
  private answers = new Map<string, { answer: string; expires: number }>();
  private contexts = new Map<string, { body: StudioExecutionRequest; expires: number }>();
  constructor(
    private readonly db: DataSource,
    private readonly studio: StudioService,
    private readonly runs: StudioRunService,
    @Optional() private readonly publications?: StudioPublicationService,
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
  ): Pick<StudioExecutionState, 'save' | 'saveOnly' | 'unsupported' | 'publish'> {
    const prompt = body.prompt.trim();
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
        /(?:게시|공유|퍼블리시)(?:\s*(?:하거나|나|또는|및|와|과)\s*(?:게시|공유|퍼블리시))*\s*(?:하지(?:는)?\s*(?:마(?:세요|라|줘)?|말(?:아(?:줘|주세요)?)?)|안\s*(?:해|하기)|금지)/gu,
        '',
      )
      .replace(
        /(?:do\s+not|don['’]?t|never)\s+(?:publish|share)(?:\s+(?:or|and)\s+(?:publish|share))?/gi,
        '',
      )
      .replace(/without\s+(?:publishing|sharing)(?:\s+(?:or|and)\s+(?:publishing|sharing))?/gi, '');
    if (
      /게시|공유|퍼블리시|publish|share/i.test(prompt) &&
      (/게시|공유|퍼블리시|publish|share/i.test(withoutNegativePublication) ||
        !/바꾸|바꿔|변경|수정|rename|edit|change|update/i.test(withoutNegativePublication))
    )
      return { save: false, saveOnly: false, unsupported: 'publish' };
    if (/복제|리믹스|remix|duplicate/i.test(prompt))
      return { save: false, saveOnly: false, unsupported: 'remix' };
    if (
      /^(?:만들어\s*줘|생성해\s*줘)[.!。]?$|(?:새|새로운)\s*대시보드|대시보드(?:를)?\s*(?:만들|생성)|create\s+(?:a\s+)?dashboard/i.test(
        prompt,
      )
    )
      return { save: false, saveOnly: false, unsupported: 'proposeSemantics' };
    const saveOnly =
      /^(?:현재\s*)?(?:초안(?:을)?\s*)?저장\s*(?:해\s*줘|해\s*주세요|해주세요|해|하기)?[.!。]?$/u.test(
        prompt,
      ) || /^(?:save|save draft)[.!]?$/i.test(prompt);
    const negative =
      /저장\s*(?:하지|하지는|안|말|금지)|저장하지|don['’]?t\s+save|do\s+not\s+save|without\s+sav/i.test(
        prompt,
      );
    // Only an explicit trailing positive command authorizes saving after an edit.
    const save =
      saveOnly ||
      (!negative &&
        /(?:하고|고|후|뒤|다음|,|그리고)\s*저장\s*(?:해\s*줘|해\s*주세요|해주세요)[.!。]?$/u.test(
          prompt,
        ));
    return { save, saveOnly };
  }
  protected stepIds(
    plan: Pick<StudioExecutionState, 'save' | 'saveOnly' | 'unsupported' | 'publish'>,
  ): StudioStepId[] {
    const ids: StudioStepId[] = ['inspectSource'];
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
          ? state.publish
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
    for (const row of rows) await this.owned(row.runId, actor);
    return rows.map(row => this.summary(row));
  }
  async get(runId: string, actor: number): Promise<any> {
    const row = await this.owned(runId, actor),
      state = this.state(row);
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
  /** Publication delegates to its durable journal; remix remains unsupported. */
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
        if (step.stepId === 'inspectSource')
          prepared = await this.studio.prepare(row.dashboardId, request, row.actorId);
        else if (state.unsupported === step.stepId)
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
        } else if (step.stepId === 'publish' || step.stepId === 'remix')
          step.status = await this.externalStep(step.stepId, row, signal);
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
          : step.stepId === 'proposeSemantics'
          ? 'MODEL_FAILED'
          : step.stepId === 'preview'
          ? 'PREVIEW_FAILED'
          : step.stepId === 'saveDraft'
          ? 'SAVE_FAILED'
          : step.stepId === 'publish'
          ? 'PUBLISH_FAILED'
          : 'STEP_FAILED';
        row.status = committed && step.stepId === 'publish' ? 'partial' : step.status;
        await this.persist(row, state);
        if (
          [401, 403, 409].includes(error?.getStatus?.()) ||
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
