jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { StudioExecutionService } from './studio-execution.service';
import { StudioExecution } from './entities/studio-execution.entity';
import { StudioRun } from './entities/studio-run.entity';
import { StudioRunService } from './studio-run.service';
import { StudioStepId } from './studio-execution-contract';
describe('T7 durable executions', () => {
  let db: DataSource, service: StudioExecutionService, studio: any, ai: any, body: any;
  const provider = process.env.AI_PROVIDER;
  beforeEach(async () => {
    process.env.AI_PROVIDER = 'codex';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [StudioExecution, StudioRun],
      synchronize: true,
    }).initialize();
    const document = JSON.parse(
      readFileSync(resolve(__dirname, '../../../fixtures/studio/document-v1.json'), 'utf8'),
    );
    document.dashboardId = 1;
    document.revision = 'a'.repeat(64);
    body = {
      requestId: 't7',
      dashboardId: 1,
      document,
      expectedRevision: document.revision,
      expectedSourceRevision: 'b'.repeat(64),
      clientEditVersion: 3,
      selectedBlockId: document.blocks[0].id,
      prompt: '제목 변경',
    };
    let tail = Promise.resolve();
    studio = {
      assertExecutionAccess: jest.fn(async (_id, _source, actor) => {
        if (actor !== 7) throw new ForbiddenException();
      }),
      prepare: jest.fn(async (_id, b, actor) => {
        if (actor !== 7) throw new ForbiddenException();
        return {
          document: b.document,
          preview: { widgets: [{ datas: [{ secretRow: 'ROW_SECRET' }] }] },
        };
      }),
      serializeWrite: (fn: any) => {
        const p = tail.then(fn);
        tail = p.catch(() => undefined);
        return p;
      },
      save: jest.fn(async (_id, b, actor, signal) =>
        studio.serializeWrite(async () => {
          if (signal?.aborted) throw new Error('cancelled');
          const prior = await db.manager.findOne(StudioRun, {
            where: { actorId: actor, requestId: b.requestId },
          });
          if (prior) return JSON.parse(prior.result);
          const result = { document: { ...b.document, revision: 'c'.repeat(64) }, idMap: {} };
          await db.manager.insert(StudioRun, {
            actorId: actor,
            requestId: b.requestId,
            payloadHash: 'd'.repeat(64),
            result: JSON.stringify(result),
          });
          return result;
        }),
      ),
    };
    ai = {
      callLlm: jest.fn(async () =>
        JSON.stringify({
          intent: 'edit',
          answer: 'PROVIDER_SECRET',
          operations: [
            { type: 'updateBlock', blockId: document.blocks[0].id, patch: { title: 'Edited' } },
          ],
        }),
      ),
    };
    service = new StudioExecutionService(db, studio, new StudioRunService(studio, ai));
  });
  afterEach(async () => {
    await db.destroy();
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
  });
  const inlineCase = async () => {
    const parent = {
      proposalId: 'meaning-parent',
      sourceId: body.document.sourceId,
      sourceRevision: body.expectedSourceRevision,
      requestPrompt: '환불률 새 대시보드',
      clarifications: [
        { id: 'refundDenominator', choices: [{ value: 'orders' }, { value: 'amount' }] },
      ],
    };
    const next = {
      ...parent,
      proposalId: 'meaning-next',
      clarifications: [],
      preview: { widgets: [] },
    };
    let receipt: any;
    const creation = {
      propose: jest.fn(async (request: any) => (request.clarificationAnswers ? next : parent)),
      proposal: jest.fn(async id => (id === parent.proposalId ? parent : next)),
      create: jest.fn(async () => {
        receipt = {
          dashboardId: 25,
          document: { sourceId: parent.sourceId, revision: 'f'.repeat(64) },
        };
        return receipt;
      }),
      receipt: jest.fn(async () => receipt),
    };
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      undefined,
      undefined,
      creation as any,
    );
    const run = await runner.create({ ...body, prompt: parent.requestPrompt }, 7);
    const answer = {
      requestId: 'answer-1',
      proposalId: parent.proposalId,
      expectedSourceRevision: parent.sourceRevision,
      refundDenominator: 'amount',
    };
    return { runner, creation, run, answer, parent, next };
  };
  it('UC033 binds the answer to the server question, updates only its proposal, and saves the latest result', async () => {
    const { runner, creation, run, answer, next } = await inlineCase();
    const updated = await runner.clarifyCreation(run.runId, answer, 7);
    expect(updated.creationResult.proposalId).toBe(next.proposalId);
    expect(creation.propose.mock.calls[1][0]).toEqual({
      sourceId: next.sourceId,
      prompt: '환불률 새 대시보드',
      expectedSourceRevision: next.sourceRevision,
      clarificationAnswers: { refundDenominator: 'amount' },
    });
    expect(studio.save).not.toHaveBeenCalled();
    expect(creation.create).not.toHaveBeenCalled();
    await expect(runner.saveCreation(run.runId, answer, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const saved = await runner.saveCreation(
      run.runId,
      { proposalId: next.proposalId, expectedSourceRevision: next.sourceRevision },
      7,
    );
    expect(saved.creationSaveResult.dashboardId).toBe(25);
    expect(
      (await runner.clarifyCreation(run.runId, answer, 7)).creationSaveResult.dashboardId,
    ).toBe(25);
    expect(creation.propose).toHaveBeenCalledTimes(2);
  });
  it('UC033 shares simultaneous identical answers and rejects a different in-flight answer', async () => {
    const { runner, creation, run, answer, next } = await inlineCase();
    let resolve: (x: any) => void;
    creation.propose.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );
    const first = runner.clarifyCreation(run.runId, answer, 7);
    while (creation.propose.mock.calls.length < 2) await new Promise(r => setImmediate(r));
    const second = runner.clarifyCreation(run.runId, answer, 7);
    await expect(
      runner.clarifyCreation(
        run.runId,
        { ...answer, requestId: 'other', refundDenominator: 'orders' },
        7,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    resolve(next);
    expect((await first).creationResult).toEqual((await second).creationResult);
    expect(creation.propose).toHaveBeenCalledTimes(2);
    await expect(
      runner.clarifyCreation(run.runId, { ...answer, refundDenominator: 'orders' }, 7),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('UC033 preserves a failed answer for retry and refuses foreign, stale or invalid answers before AI', async () => {
    const { runner, creation, run, answer } = await inlineCase();
    await expect(runner.clarifyCreation(run.runId, answer, 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      runner.clarifyCreation(run.runId, { ...answer, proposalId: 'foreign' }, 7),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      runner.clarifyCreation(run.runId, { ...answer, refundDenominator: 'guess' }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
    creation.propose.mockRejectedValueOnce(new ServiceUnavailableException('temporary'));
    await expect(runner.clarifyCreation(run.runId, answer, 7)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect((await runner.get(run.runId, 7)).creationResult.proposalId).toBe(answer.proposalId);
    expect((await runner.clarifyCreation(run.runId, answer, 7)).creationResult.proposalId).toBe(
      'meaning-next',
    );
  });
  it('UC033 rejects an expired parent and a late response after the run binding changed', async () => {
    const { runner, creation, run, answer, next } = await inlineCase();
    creation.proposal.mockRejectedValueOnce(new BadRequestException('expired'));
    await expect(runner.clarifyCreation(run.runId, answer, 7)).rejects.toThrow('expired');
    let resolve: (x: any) => void;
    creation.propose.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );
    const first = runner.clarifyCreation(run.runId, answer, 7);
    while (creation.propose.mock.calls.length < 2) await new Promise(r => setImmediate(r));
    const row = await db.manager.findOneBy(StudioExecution, { runId: run.runId });
    const state = JSON.parse(row.state);
    state.creationResult.proposalId = 'newer';
    row.state = JSON.stringify(state);
    await db.manager.save(StudioExecution, row);
    resolve(next);
    await expect(first).rejects.toBeInstanceOf(ConflictException);
    expect((await runner.get(run.runId, 7)).creationResult.proposalId).toBe('newer');
  });
  it('UC033 preserves the question on cancellation and replays a completed answer after service restart without AI', async () => {
    const { runner, creation, run, answer } = await inlineCase();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runner.clarifyCreation(run.runId, answer, 7, controller.signal),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(creation.propose).toHaveBeenCalledTimes(1);
    await runner.clarifyCreation(run.runId, answer, 7);
    const restarted = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      undefined,
      undefined,
      creation as any,
    );
    creation.proposal.mockRejectedValue(new BadRequestException('expired'));
    expect((await restarted.clarifyCreation(run.runId, answer, 7)).creationResult.proposalId).toBe(
      'meaning-next',
    );
    expect(creation.propose).toHaveBeenCalledTimes(2);
    const row = await db.manager.findOneBy(StudioExecution, { runId: run.runId });
    expect(row.state).not.toContain('환불률 새 대시보드');
    expect(row.state).not.toContain('widgets');
  });
  it('T15 routes generation to the existing compiler, binds explicit save, and restores one receipt', async () => {
    const proposal = {
      proposalId: 'proposal-t15',
      sourceId: body.document.sourceId,
      sourceRevision: body.expectedSourceRevision,
      preview: { secretRow: 'PREVIEW_SECRET' },
    };
    let receipt: any;
    const creation = {
      propose: jest.fn(async (request: any) => {
        expect(request.sourceId).toBe(proposal.sourceId);
        return proposal;
      }),
      proposal: jest.fn(async () => proposal),
      create: jest.fn(async request => {
        receipt ??= {
          dashboardId: 25,
          document: { sourceId: proposal.sourceId, revision: 'f'.repeat(64) },
        };
        expect(request.requestId).toMatch(/^execution-.*-create$/);
        return receipt;
      }),
      receipt: jest.fn(async () => receipt),
    };
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      undefined,
      undefined,
      creation as any,
    );
    const generated = await runner.create(
      { ...body, prompt: '새 대시보드를 만들어줘 요청 수와 차원을 제안해줘' },
      7,
    );
    expect(generated.status).toBe('succeeded');
    expect(generated.steps.map(s => s.stepId)).toEqual(['inspectSource', 'createProposal']);
    expect(generated.creationResult).toEqual({
      proposalId: proposal.proposalId,
      sourceId: proposal.sourceId,
      sourceRevision: proposal.sourceRevision,
    });
    expect(generated.saveResult).toBeUndefined();
    expect(creation.propose).toHaveBeenCalledTimes(1);
    expect(creation.propose.mock.calls[0][0]).toMatchObject({
      expectedFileRevision: body.expectedSourceRevision,
    });
    expect(creation.propose.mock.calls[0][0]).not.toHaveProperty('expectedSourceRevision');
    expect(studio.prepare).not.toHaveBeenCalled();
    expect(studio.save).not.toHaveBeenCalled();
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(creation.create).not.toHaveBeenCalled();
    expect(await runner.creationProposal(generated.runId, 7)).toEqual(proposal);
    const raw = (await db.manager.findOneBy(StudioExecution, { runId: generated.runId })).state;
    expect(raw).not.toContain('PREVIEW_SECRET');
    expect(raw).not.toContain('차원을 제안');
    await expect(runner.creationProposal(generated.runId, 8)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      runner.saveCreation(
        generated.runId,
        { proposalId: 'other', expectedSourceRevision: proposal.sourceRevision },
        7,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(creation.create).not.toHaveBeenCalled();
    const confirmation = {
      proposalId: proposal.proposalId,
      expectedSourceRevision: proposal.sourceRevision,
    };
    const saved = await runner.saveCreation(generated.runId, confirmation, 7);
    expect(saved.creationSaveResult.dashboardId).toBe(25);
    await runner.saveCreation(generated.runId, confirmation, 7);
    expect(creation.create.mock.calls[0][0]).toEqual(creation.create.mock.calls[1][0]);
    const restarted = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      undefined,
      undefined,
      creation as any,
    );
    expect((await restarted.list(1, 7))[0].creationSaveResult.dashboardId).toBe(25);
    expect(creation.propose).toHaveBeenCalledTimes(1);
  });
  it('T15 plans private creation with negative sharing, but never creates from prohibitions or positive public sharing', () => {
    expect(
      (service as any).plan({ ...body, prompt: '새 대시보드를 만들어줘. 공유하지 마' }),
    ).toEqual({ save: false, saveOnly: false, create: true });
    expect(
      (service as any).plan({ ...body, prompt: '새 대시보드를 만들어줘, 저장하지 마' }),
    ).toEqual({ save: false, saveOnly: false, create: true });
    for (const prompt of [
      '새 대시보드를 생성하지 마',
      '새 대시보드 만들지 마',
      '새 대시보드를 만들어서 공유해줘',
      "Don't create a dashboard",
    ])
      expect((service as any).plan({ ...body, prompt }).create).not.toBe(true);
  });
  it('T15 recovers a committed creation after a lost response without repeating generation', async () => {
    let committed = false;
    const p = {
      proposalId: 'p2',
      sourceId: body.document.sourceId,
      sourceRevision: body.expectedSourceRevision,
    };
    const creation = {
      propose: jest.fn(async () => p),
      create: jest.fn(async () => {
        committed = true;
        throw new Error('response lost');
      }),
      receipt: jest.fn(async () =>
        committed
          ? { dashboardId: 26, document: { sourceId: p.sourceId, revision: 'f'.repeat(64) } }
          : undefined,
      ),
    };
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      undefined,
      undefined,
      creation as any,
    );
    const run = await runner.create({ ...body, prompt: '새 대시보드 생성' }, 7);
    await expect(
      runner.saveCreation(
        run.runId,
        { proposalId: p.proposalId, expectedSourceRevision: p.sourceRevision },
        7,
      ),
    ).rejects.toThrow('response lost');
    expect((await runner.get(run.runId, 7)).creationSaveResult.dashboardId).toBe(26);
    expect(creation.propose).toHaveBeenCalledTimes(1);
  });
  const remixAdapter = () => ({
    ownerMetadata: jest.fn(async () => ({ token: 'e'.repeat(64) })),
    requireRemix: jest.fn(async () => ({
      token: 'e'.repeat(64),
      version: 2,
      remixTemplate: 'PRIVATE_DEFINITION',
    })),
    publish: jest.fn(),
    committed: jest.fn(async () => undefined),
  });
  it.each([
    '이 대시보드를 내 데이터로 복제해줘',
    '현재 게시본을 내 데이터로 복제해 주세요.',
    'Remix this dashboard with my data',
  ])('T11 prepares current publication mapping without AI or writes: %s', async prompt => {
    const publications = remixAdapter();
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const result = await runner.create({ ...body, prompt }, 7);
    expect(result.status).toBe('succeeded');
    expect(result.remixResult).toEqual({ token: 'e'.repeat(64), version: 2 });
    expect(result.steps.map(s => s.stepId)).toEqual(['inspectSource', 'remix']);
    expect(publications.requireRemix).toHaveBeenCalledWith('e'.repeat(64), 7);
    expect(studio.prepare).not.toHaveBeenCalled();
    expect(studio.save).not.toHaveBeenCalled();
    expect(publications.publish).not.toHaveBeenCalled();
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('PRIVATE_DEFINITION');
    const restarted = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    expect((await restarted.get(result.runId, 7)).remixResult).toEqual(result.remixResult);
    expect((await restarted.list(1, 7))[0].remixResult).toEqual(result.remixResult);
    expect((await restarted.create({ ...body, prompt }, 7)).runId).toBe(result.runId);
    expect(publications.requireRemix).toHaveBeenCalledTimes(1);
  });
  it.each(['/published/', 'http://127.0.0.1:3229/published/'])(
    'T11 checks an explicitly referenced publication locally: %s',
    async prefix => {
      const publications = remixAdapter();
      const runner = new StudioExecutionService(
        db,
        studio,
        new StudioRunService(studio, ai),
        publications as any,
      );
      const result = await runner.create(
        { ...body, prompt: '내 데이터로 복제해줘 ' + prefix + 'e'.repeat(64) },
        7,
      );
      expect(result.status).toBe('succeeded');
      expect(result.remixResult?.version).toBe(2);
      expect(publications.ownerMetadata).not.toHaveBeenCalled();
      expect(publications.requireRemix).toHaveBeenCalledWith('e'.repeat(64), 7);
    },
  );
  it.each([
    '내 데이터로 복제하지 마',
    '내 데이터로 복제해줘 그리고 게시해줘',
    '내 데이터로 복제해줘 /published/invalid',
    '내 데이터로 복제해줘 /published/' + 'e'.repeat(64) + ' /published/' + 'f'.repeat(64),
  ])('T11 does not route ambiguous, negative or malformed remix commands: %s', async prompt => {
    const publications = remixAdapter();
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const result = await runner.create({ ...body, prompt }, 7);
    expect(result.status).toBe('unsupported');
    expect(result.remixResult).toBeUndefined();
    expect(publications.requireRemix).not.toHaveBeenCalled();
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(studio.save).not.toHaveBeenCalled();
  });
  it('T11 retries only the failed permission check and creates no duplicate or write', async () => {
    const publications = remixAdapter();
    publications.requireRemix
      .mockRejectedValueOnce({ getStatus: () => 410 })
      .mockRejectedValueOnce({ getStatus: () => 403 });
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const first = await runner.create({ ...body, prompt: '내 데이터로 복제해줘' }, 7);
    expect(first.status).toBe('failed');
    const restarted = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const denied = await restarted.retry(first.runId, { stepId: 'remix' }, 7);
    expect(denied.status).toBe('failed');
    expect(denied.remixResult).toBeUndefined();
    const recovered = await restarted.retry(first.runId, { stepId: 'remix' }, 7);
    expect(recovered.status).toBe('succeeded');
    expect(recovered.runId).toBe(first.runId);
    expect(recovered.remixResult).toEqual({ token: 'e'.repeat(64), version: 2 });
    expect(await db.manager.count(StudioExecution)).toBe(1);
    expect(publications.requireRemix).toHaveBeenCalledTimes(3);
    expect(publications.publish).not.toHaveBeenCalled();
    expect(studio.prepare).not.toHaveBeenCalled();
    expect(studio.save).not.toHaveBeenCalled();
    expect(ai.callLlm).not.toHaveBeenCalled();
  });
  it('T11 exposes no handoff when cancelled during publication check', async () => {
    const controller = new AbortController();
    const publications = remixAdapter();
    publications.requireRemix.mockImplementationOnce(async () => {
      controller.abort();
      return { token: 'e'.repeat(64), version: 2, remixTemplate: '' };
    });
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const result = await runner.create(
      { ...body, prompt: '내 데이터로 복제해줘' },
      7,
      controller.signal,
    );
    expect(result.status).toBe('cancelled');
    expect(result.remixResult).toBeUndefined();
    expect((await runner.get(result.runId, 7)).remixResult).toBeUndefined();
  });
  it.each([403, 404, 410])(
    'T11 rejects unavailable publication with no handoff: %i',
    async status => {
      const publications = remixAdapter();
      publications.requireRemix.mockRejectedValueOnce({ getStatus: () => status });
      const runner = new StudioExecutionService(
        db,
        studio,
        new StudioRunService(studio, ai),
        publications as any,
      );
      const result = await runner.create({ ...body, prompt: '내 데이터로 복제해줘' }, 7);
      expect(result.status).toBe('failed');
      expect(result.remixResult).toBeUndefined();
      expect(result.steps.find(s => s.stepId === 'remix').errorCode).toBe('REMIX_UNAVAILABLE');
      expect(studio.save).not.toHaveBeenCalled();
    },
  );
  it('retries only preview across process without storing prompt, rows, SQL or model answer', async () => {
    studio.prepare
      .mockImplementationOnce(async (_id, b) => ({
        document: b.document,
        preview: { widgets: [] },
      }))
      .mockRejectedValueOnce(new Error('SQL token SECRET'));
    const first = await service.create(body, 7);
    expect(first.status).toBe('failed');
    expect(first.steps.find(s => s.stepId === 'proposeSemantics').status).toBe('succeeded');
    const restarted = new StudioExecutionService(db, studio, new StudioRunService(studio, ai));
    expect((await restarted.retry(first.runId, { stepId: 'preview' }, 7)).status).toBe('succeeded');
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
    const stored = JSON.stringify(await db.manager.find(StudioExecution));
    for (const secret of [body.prompt, 'ROW_SECRET', 'PROVIDER_SECRET', 'SQL token SECRET'])
      expect(stored).not.toContain(secret);
  });
  it('replays durable ID with zero writes and rejects different hash/document/manual version', async () => {
    const first = await service.create(body, 7);
    const write = jest.spyOn(db.manager, 'save');
    expect((await service.create(body, 7)).runId).toBe(first.runId);
    expect(write).not.toHaveBeenCalled();
    for (const change of [
      { prompt: 'other' },
      { clientEditVersion: 4 },
      { document: { ...body.document, title: 'manual' } },
    ])
      await expect(service.create({ ...body, ...change }, 7)).rejects.toMatchObject({
        status: 409,
      });
  });
  it('returns owned context/list and checks revoked original/current source permissions', async () => {
    const first = await service.create(body, 7);
    expect(await service.list(1, 7)).toEqual([
      expect.objectContaining({
        requestId: 't7',
        dashboardId: 1,
        runId: first.runId,
        clientEditVersion: 3,
      }),
    ]);
    await expect(service.get(first.runId, 8)).rejects.toMatchObject({ status: 403 });
    studio.assertExecutionAccess.mockRejectedValue(new ForbiddenException());
    await expect(service.get(first.runId, 7)).rejects.toMatchObject({ status: 403 });
  });
  it('marks startup running work interrupted with no autorun; requires matching original request', async () => {
    ai.callLlm.mockRejectedValue(new Error('provider stderr SECRET'));
    const first = await service.create(body, 7);
    await db.manager.update(StudioExecution, { runId: first.runId }, { status: 'running' });
    const restarted = new StudioExecutionService(db, studio, new StudioRunService(studio, ai));
    await restarted.onModuleInit();
    expect(await restarted.get(first.runId, 7)).toMatchObject({
      status: 'interrupted',
      requiresRequest: true,
    });
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
    await expect(
      restarted.retry(
        first.runId,
        { stepId: 'proposeSemantics', request: { ...body, clientEditVersion: 4 } },
        7,
      ),
    ).rejects.toMatchObject({ status: 409 });
    ai.callLlm.mockResolvedValue(JSON.stringify({ intent: 'ask', answer: 'ok', operations: [] }));
    expect(
      (await restarted.retry(first.runId, { stepId: 'proposeSemantics', request: body }, 7)).status,
    ).toBe('succeeded');
  });
  it('saves exact current draft without model, recovers committed journal and never duplicates save', async () => {
    body.prompt = '저장해줘';
    const first = await service.create(body, 7);
    expect(first.saveResult.document.revision).toBe('c'.repeat(64));
    expect(ai.callLlm).not.toHaveBeenCalled();
    await db.manager.update(StudioExecution, { runId: first.runId }, { status: 'running' });
    const restarted = new StudioExecutionService(db, studio, new StudioRunService(studio, ai));
    await restarted.onModuleInit();
    expect((await restarted.get(first.runId, 7)).saveResult).toEqual(first.saveResult);
    expect((await restarted.create(body, 7)).status).toBe('succeeded');
    expect(await db.manager.count(StudioRun)).toBe(1);
  });
  it('keeps stale 409 and does not save negative save or invoke edit model for unsupported publish/remix', async () => {
    studio.prepare.mockRejectedValueOnce(new ConflictException());
    await expect(service.create(body, 7)).rejects.toMatchObject({ status: 409 });
    let n = 0;
    for (const prompt of ['게시해줘', '공유해줘', '복제해줘']) {
      const r = await service.create({ ...body, requestId: 'unsupported' + n++, prompt }, 7);
      expect(r.steps.some(s => s.status === 'unsupported')).toBe(true);
    }
    expect(ai.callLlm).not.toHaveBeenCalled();
    await service.create({ ...body, requestId: 'negative', prompt: '제목 바꾸고 저장하지마' }, 7);
    expect(studio.save).not.toHaveBeenCalled();
  });
  it.each([
    '선택한 블록의 제목만 커머스 환불률로 바꾸고 저장해 줘. 계산식과 배치는 유지하고 게시하지 마.',
    '선택한 제목을 바꾸고 저장해 줘! 게시하지 마.',
  ])('saves an explicit sentence before trailing preservation constraints: %s', async prompt => {
    const result = await service.create({ ...body, prompt }, 7);
    expect(result.status).toBe('succeeded');
    expect(studio.save).toHaveBeenCalledTimes(1);
    expect(result.steps.map(s => s.stepId)).toContain('saveDraft');
    expect(result.steps.map(s => s.stepId)).not.toContain('publish');
  });
  it.each([
    '선택한 제목을 "그리고 저장해 줘."로 바꿔. 게시하지 마.',
    '선택한 제목을 바꾸고 저장해 줘. 하지만 저장하지 마.',
  ])('does not infer save consent from a quoted example or negative save: %s', async prompt => {
    await service.create({ ...body, prompt }, 7);
    expect(studio.save).not.toHaveBeenCalled();
  });
  it.each([
    '선택한 블록 제목만 바꾸고 저장하거나 게시하지 마.',
    '현재 조건을 설명하고 선택한 제목만 바꿔줘. 저장과 게시는 하지 마.',
    '선택한 블록 제목만 바꿔줘. 게시하지 마.',
    '선택한 블록 제목만 바꾸고 공유하지 말아줘.',
    'Rename the selected block; do not publish.',
    "Rename the selected block; don't share.",
    'Rename the selected block without publishing.',
  ])('T10 applies edits with negative publication intent without saving: %s', async prompt => {
    const result = await service.create({ ...body, prompt }, 7);
    expect(result.status).toBe('succeeded');
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
    expect(studio.save).not.toHaveBeenCalled();
    expect(result.steps.map(s => s.stepId)).toEqual([
      'inspectSource',
      'proposeSemantics',
      'preview',
      'applyDraft',
    ]);
  });
  it.each([
    '게시하지 마. 하지만 링크로 공유해줘',
    '공유하지 말고 publish 해줘',
    'Do not share but publish this dashboard',
  ])('T10 never authorizes publication when a positive clause remains: %s', async prompt => {
    const result = await service.create({ ...body, prompt }, 7);
    expect(result.status).toBe('unsupported');
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(studio.save).not.toHaveBeenCalled();
  });
  it('cancel before commit writes zero, cancel after commit reports completed', async () => {
    let release: any;
    const gate = new Promise(r => {
      release = r;
    });
    studio.prepare.mockImplementationOnce(async (_id, b) => {
      await gate;
      return { document: b.document, preview: { widgets: [] } };
    });
    const pending = service.create({ ...body, prompt: '저장해줘' }, 7);
    while (!studio.prepare.mock.calls.length) await new Promise(r => setImmediate(r));
    const [row] = await service.list(1, 7);
    const cancelled = service.cancel(row.runId, 7);
    release();
    await cancelled;
    expect((await pending).status).toBe('cancelled');
    expect(await db.manager.count(StudioRun)).toBe(0);
    const completed = await service.create({ ...body, requestId: 'save2', prompt: '저장해줘' }, 7);
    expect((await service.cancel(completed.runId, 7)).status).toBe('succeeded');
    expect(await db.manager.count(StudioRun)).toBe(1);
  });
  it('does not save when combined edit request needs clarification or is unsupported', async () => {
    for (const intent of ['clarify', 'unsupported']) {
      ai.callLlm.mockResolvedValue(JSON.stringify({ intent, answer: 'safe', operations: [] }));
      const result = await service.create(
        { ...body, requestId: intent, prompt: '제목 바꾸고 저장해줘' },
        7,
      );
      expect(studio.save).not.toHaveBeenCalled();
      expect(result.steps.some(s => s.status === 'unsupported')).toBe(true);
    }
  });
  it('STUDIO-A03 preserves committed save on injected next stage failure; retry never repeats save or claims publish success', async () => {
    class PartialRunner extends StudioExecutionService {
      private fail = true;
      protected plan() {
        return { save: true, saveOnly: true, unsupported: undefined };
      }
      protected stepIds(plan): StudioStepId[] {
        return [...super.stepIds(plan), 'publish'];
      }
      protected async externalStep() {
        if (this.fail) {
          this.fail = false;
          throw new Error('injected next stage');
        }
        return 'unsupported' as const;
      }
    }
    const runner = new PartialRunner(db, studio, new StudioRunService(studio, ai));
    const first = await runner.create({ ...body, prompt: '저장해줘' }, 7);
    expect(first.status).toBe('partial');
    expect(first.saveResult).toBeDefined();
    const next = await runner.retry(first.runId, { stepId: 'publish' }, 7);
    expect(next.status).toBe('unsupported');
    expect(next.steps.find(s => s.stepId === 'saveDraft').status).toBe('succeeded');
    expect(next.steps.find(s => s.stepId === 'publish').status).toBe('unsupported');
    expect(studio.save).toHaveBeenCalledTimes(1);
    expect(await db.manager.count(StudioRun)).toBe(1);
  });
  it('returns the validated numerical answer live and in immediate GET but never in durable history', async () => {
    const answer = '확인한 전체 요청 수는 1,234입니다.';
    ai.callLlm.mockResolvedValue(JSON.stringify({ intent: 'ask', answer, operations: [] }));
    const first = await service.create(body, 7);
    expect(first.result.answer).toBe(answer);
    expect((await service.get(first.runId, 7)).result.answer).toBe(answer);
    expect(JSON.stringify(await db.manager.find(StudioExecution))).not.toContain(answer);
    const restarted = new StudioExecutionService(db, studio, new StudioRunService(studio, ai));
    expect((await restarted.get(first.runId, 7)).result.answer).toContain('보관하지');
  });
  it('links disconnected POST signal before run ID is known and never commits save', async () => {
    let release: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    studio.prepare.mockImplementationOnce(async (_id, b) => {
      await gate;
      return { document: b.document, preview: { widgets: [] } };
    });
    const controller = new AbortController();
    const pending = service.create({ ...body, prompt: '저장해줘' }, 7, controller.signal);
    while (!studio.prepare.mock.calls.length) await new Promise(r => setImmediate(r));
    controller.abort();
    release();
    expect((await pending).status).toBe('cancelled');
    expect(studio.save).not.toHaveBeenCalled();
    expect(await db.manager.count(StudioRun)).toBe(0);
  });
  it('does not launch after disconnect during ownership check, and reports committed save after late disconnect', async () => {
    const controller = new AbortController();
    studio.assertExecutionAccess.mockImplementationOnce(async () => {
      controller.abort();
    });
    await expect(service.create(body, 7, controller.signal)).rejects.toThrow('취소');
    expect(await db.manager.count(StudioExecution)).toBe(0);
    expect(ai.callLlm).not.toHaveBeenCalled();
    const late = new AbortController();
    const save = studio.save;
    studio.save = jest.fn(async (...args) => {
      const result = await save(...args);
      late.abort();
      return result;
    });
    const committed = await service.create(
      { ...body, requestId: 'late', prompt: '저장해줘' },
      7,
      late.signal,
    );
    expect(committed.status).toBe('succeeded');
    expect(committed.saveResult).toBeDefined();
  });
  it('accepts reducer documents without revision and preserves separate expectedRevision for GET preview', async () => {
    delete body.document.revision;
    studio.prepare.mockImplementation(async (_id, request) => {
      if (request.expectedRevision !== body.expectedRevision) throw new ConflictException();
      return { document: request.document, preview: { widgets: [] } };
    });
    const result = await service.create(body, 7);
    expect(result.status).toBe('succeeded');
    expect(result.result.baseRevision).toBe(body.expectedRevision);
    expect((await service.get(result.runId, 7)).result).toBeDefined();
    await expect(
      service.create(
        {
          ...body,
          requestId: 'mismatched-document-revision',
          document: { ...body.document, revision: 'f'.repeat(64) },
        },
        7,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('exposes only a stable 64-character base document hash with revision omitted', async () => {
    const first = await service.create(body, 7);
    delete body.document.revision;
    const second = await service.create({ ...body, requestId: 'without-revision' }, 7);
    expect(first.baseDocumentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.baseDocumentHash).toBe(first.baseDocumentHash);
    const summaries = await service.list(1, 7);
    for (const summary of summaries) {
      expect(summary.baseDocumentHash).toBe(first.baseDocumentHash);
      expect(summary).not.toHaveProperty('document');
      expect(summary).not.toHaveProperty('prompt');
    }
  });
  const publicationAdapter = () => {
    const journal = new Map<string, any>();
    const published = {
      token: 'e'.repeat(64),
      version: 1,
      visibility: 'link',
      allowRemix: false,
      expiresAt: null,
      revokedAt: null,
      asOf: '2026-10-15T00:00:00.000Z',
      dataVersion: 'f'.repeat(64),
      dashboardId: 1,
    };
    return {
      journal,
      committed: jest.fn(async id => journal.get(id)),
      publish: jest.fn(async (_dashboardId, b) => {
        journal.set(b.requestId, published);
        return published;
      }),
    };
  };
  it('T8 explicitly saves then publishes the committed revision without model; replay writes nothing', async () => {
    const publications = publicationAdapter();
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const request = { ...body, prompt: '저장하고 링크로 공유해줘' };
    const result = await runner.create(request, 7);
    expect(result.status).toBe('succeeded');
    expect(result.steps.map(s => [s.stepId, s.status])).toEqual([
      ['inspectSource', 'succeeded'],
      ['saveDraft', 'succeeded'],
      ['publish', 'succeeded'],
    ]);
    expect(publications.publish).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        expectedRevision: 'c'.repeat(64),
        visibility: 'link',
        allowRemix: false,
      }),
      7,
      expect.any(AbortSignal),
    );
    expect(result.publicationResult.token).toBe('e'.repeat(64));
    expect((await runner.list(1, 7))[0].publicationResult).toEqual(result.publicationResult);
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect((await runner.create(request, 7)).publicationResult).toEqual(result.publicationResult);
    expect(publications.publish).toHaveBeenCalledTimes(1);
    expect(studio.save).toHaveBeenCalledTimes(1);
  });
  it('T8 publish failure is partial, retains committed save and retries only publication across restart', async () => {
    const publications = publicationAdapter();
    publications.publish.mockRejectedValueOnce(new Error('provider SQL SECRET'));
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const first = await runner.create({ ...body, prompt: '저장하고 링크로 공유해줘' }, 7);
    expect(first.status).toBe('partial');
    expect(first.saveResult).toBeDefined();
    expect(first.publicationResult).toBeUndefined();
    expect(first.steps.find(s => s.stepId === 'publish')).toMatchObject({
      status: 'failed',
      errorCode: 'PUBLISH_FAILED',
      retryable: true,
    });
    const restarted = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const next = await restarted.retry(first.runId, { stepId: 'publish' }, 7);
    expect(next.status).toBe('succeeded');
    expect(next.publicationResult).toBeDefined();
    expect(studio.save).toHaveBeenCalledTimes(1);
    expect(ai.callLlm).not.toHaveBeenCalled();
    expect(await db.manager.count(StudioRun)).toBe(1);
    expect(JSON.stringify(await db.manager.find(StudioExecution))).not.toContain(
      'provider SQL SECRET',
    );
  });
  it('T8 recovers committed publication after response loss/restart and blocks ambiguous or negative consent', async () => {
    const publications = publicationAdapter();
    const real = publications.publish.getMockImplementation();
    publications.publish.mockImplementationOnce(async (...args) => {
      await (real as any)(...args);
      throw new Error('lost response');
    });
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const first = await runner.create({ ...body, prompt: '저장하고 링크로 공유해줘' }, 7);
    expect(first.status).toBe('succeeded');
    expect(first.publicationResult).toBeDefined();
    await db.manager.update(StudioExecution, { runId: first.runId }, { status: 'running' });
    const restarted = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    await restarted.onModuleInit();
    expect((await restarted.get(first.runId, 7)).status).toBe('succeeded');
    for (const [i, prompt] of [
      '공유해줘',
      '저장하고 공유해줘',
      '저장하고 링크로 공유하지마',
      'do not save and share link',
    ].entries()) {
      const result = await restarted.create({ ...body, requestId: 'ambiguous' + i, prompt }, 7);
      expect(result.status).toBe('unsupported');
    }
    expect(publications.publish).toHaveBeenCalledTimes(1);
    expect(studio.save).toHaveBeenCalledTimes(1);
  });
  it.each(['failed', 'interrupted'])(
    'T8 cancels unfinished %s publication while retaining committed save; retry rejects',
    async status => {
      const publications = publicationAdapter();
      publications.publish.mockRejectedValueOnce(new Error('publish failed'));
      const runner = new StudioExecutionService(
        db,
        studio,
        new StudioRunService(studio, ai),
        publications as any,
      );
      const first = await runner.create({ ...body, prompt: '저장하고 링크로 공유해줘' }, 7);
      if (status === 'interrupted') {
        const row = await db.manager.findOne(StudioExecution, { where: { runId: first.runId } });
        const state = JSON.parse(row.state);
        state.steps.find(s => s.stepId === 'publish').status = 'running';
        row.state = JSON.stringify(state);
        row.status = 'running';
        await db.manager.save(StudioExecution, row);
        await runner.onModuleInit();
      }
      const cancelled = await runner.cancel(first.runId, 7);
      expect(cancelled.status).toBe('partial');
      expect(cancelled.saveResult).toBeDefined();
      expect(cancelled.steps.find(s => s.stepId === 'saveDraft').status).toBe('succeeded');
      expect(cancelled.steps.find(s => s.stepId === 'publish')).toMatchObject({
        status: 'cancelled',
        retryable: false,
      });
      await expect(runner.retry(first.runId, { stepId: 'publish' }, 7)).rejects.toMatchObject({
        status: 409,
      });
      expect(publications.publish).toHaveBeenCalledTimes(1);
      expect(studio.save).toHaveBeenCalledTimes(1);
    },
  );
  it('T8 cancel after publication commit reports succeeded even if the execution receipt was interrupted', async () => {
    const publications = publicationAdapter();
    const runner = new StudioExecutionService(
      db,
      studio,
      new StudioRunService(studio, ai),
      publications as any,
    );
    const first = await runner.create({ ...body, prompt: '저장하고 링크로 공유해줘' }, 7);
    const row = await db.manager.findOne(StudioExecution, { where: { runId: first.runId } });
    const state = JSON.parse(row.state);
    state.steps.find(s => s.stepId === 'publish').status = 'running';
    row.status = 'running';
    row.state = JSON.stringify(state);
    await db.manager.save(StudioExecution, row);
    const cancelled = await runner.cancel(first.runId, 7);
    expect(cancelled.status).toBe('succeeded');
    expect(cancelled.publicationResult).toBeDefined();
    expect(cancelled.steps.find(s => s.stepId === 'publish')).toMatchObject({
      status: 'succeeded',
      retryable: false,
    });
    expect(publications.publish).toHaveBeenCalledTimes(1);
  });
  describe('T14 confirmed in-conversation clone', () => {
    const confirmation = () => ({
      requestId: 'client-confirm',
      targetSourceId: 22,
      mapping: { amount: 'amount' },
      excludedBlockIds: [],
      expectedVersion: 2,
      expectedSourceRevision: 'b'.repeat(64),
    });
    const harness = async () => {
      const journals = new Map<string, any>();
      const remixer = {
        receipt: jest.fn(async (_actor: number, requestId: string) => journals.get(requestId)),
        remix: jest.fn(async (token: string, request: any) => {
          const id = request.requestId;
          if (!journals.has(id))
            journals.set(id, {
              dashboardId: 44,
              sourceId: 22,
              revision: 'f'.repeat(64),
              payloadHash: (await import('./studio-legacy')).studioDigest({ token, ...request }),
            });
          return { dashboardId: 44, document: { revision: 'f'.repeat(64) } };
        }),
      };
      const runner = new StudioExecutionService(
        db,
        studio,
        new StudioRunService(studio, ai),
        remixAdapter() as any,
        remixer as any,
      );
      const run = await runner.create({ ...body, prompt: '내 데이터로 복제해줘' }, 7);
      return { runner, run, remixer, journals };
    };
    it('commits once for concurrent and refreshed-client confirmations, preserving original editor and model', async () => {
      const { runner, run, remixer } = await harness();
      const [first, second] = await Promise.all([
        runner.remix(run.runId, confirmation(), 7),
        runner.remix(run.runId, { ...confirmation(), requestId: 'new-client-id' }, 7),
      ]);
      expect(first.remixSaveResult).toEqual({
        dashboardId: 44,
        sourceId: 22,
        revision: 'f'.repeat(64),
        version: 2,
      });
      expect(second.remixSaveResult).toEqual(first.remixSaveResult);
      expect((await runner.remix(run.runId, confirmation(), 7)).remixSaveResult).toEqual(
        first.remixSaveResult,
      );
      expect((await runner.list(1, 7))[0].remixSaveResult).toEqual(first.remixSaveResult);
      expect(remixer.remix).toHaveBeenCalledTimes(1);
      expect(studio.save).not.toHaveBeenCalled();
      expect(ai.callLlm).not.toHaveBeenCalled();
    });
    it('refuses foreign actors, forged tokens, stale versions and changed confirmation after commit', async () => {
      const { runner, run, remixer } = await harness();
      await expect(runner.remix(run.runId, confirmation(), 8)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        runner.remix(run.runId, { ...confirmation(), token: 'a'.repeat(64) }, 7),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        runner.remix(run.runId, { ...confirmation(), expectedVersion: 3 }, 7),
      ).rejects.toMatchObject({ status: 409 });
      expect(remixer.remix).not.toHaveBeenCalled();
      await runner.remix(run.runId, confirmation(), 7);
      await expect(
        runner.remix(run.runId, { ...confirmation(), mapping: { amount: 'another' } }, 7),
      ).rejects.toMatchObject({ status: 409 });
      expect(remixer.remix).toHaveBeenCalledTimes(1);
    });
    it('recovers a committed clone from its journal after response loss and service restart without another write', async () => {
      const { runner, run, remixer } = await harness();
      const real = remixer.remix.getMockImplementation();
      remixer.remix.mockImplementationOnce(async (...args: any[]) => {
        await (real as any)(...args);
        throw new Error('response lost');
      });
      await expect(runner.remix(run.runId, confirmation(), 7)).rejects.toThrow('response lost');
      const restarted = new StudioExecutionService(
        db,
        studio,
        new StudioRunService(studio, ai),
        remixAdapter() as any,
        remixer as any,
      );
      expect((await restarted.get(run.runId, 7)).remixSaveResult.dashboardId).toBe(44);
      expect((await restarted.list(1, 7))[0].remixSaveResult.dashboardId).toBe(44);
      expect(
        (await restarted.remix(run.runId, confirmation(), 7)).remixSaveResult.dashboardId,
      ).toBe(44);
      expect(remixer.remix).toHaveBeenCalledTimes(1);
    });
    it('permits corrected mapping after a proven refusal but never duplicates a committed clone', async () => {
      const { runner, run, remixer } = await harness();
      remixer.remix.mockRejectedValueOnce(new BadRequestException('missing column'));
      await expect(runner.remix(run.runId, confirmation(), 7)).rejects.toMatchObject({
        status: 400,
      });
      expect(
        (await runner.remix(run.runId, { ...confirmation(), mapping: { amount: 'corrected' } }, 7))
          .remixSaveResult.dashboardId,
      ).toBe(44);
      expect(remixer.remix).toHaveBeenCalledTimes(2);
    });
    it('rechecks access to the private clone on get/list and does not leak a stale receipt', async () => {
      const { runner, run } = await harness();
      await runner.remix(run.runId, confirmation(), 7);
      studio.assertExecutionAccess.mockImplementation(async (id: number) => {
        if (id === 44) throw new ForbiddenException();
      });
      await expect(runner.get(run.runId, 7)).rejects.toMatchObject({ status: 403 });
      await expect(runner.list(1, 7)).rejects.toMatchObject({ status: 403 });
    });
    it('does not create a clone when publication access changed after preparing the conversation', async () => {
      const { runner, run, remixer } = await harness();
      remixer.remix.mockRejectedValueOnce(new ForbiddenException());
      await expect(runner.remix(run.runId, confirmation(), 7)).rejects.toMatchObject({
        status: 403,
      });
      expect((await runner.get(run.runId, 7)).remixSaveResult).toBeUndefined();
    });
  });
});
