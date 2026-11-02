import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { User } from '../user/entities/user.entity';
import { sourceWriteTransaction } from '../database/source-write-lock';
import {
  documentText,
  splitsSurrogate,
  textAnchorAt,
  textAnchorProblem,
} from '../reports/report-anchor';
import { CommentOperation, ReportTextAnchor } from '../reports/report-comment-contract';
import {
  CommentWriteOptions,
  ReportCommentService,
  RequestReusedException,
} from '../reports/report-comment.service';
import { ReportDelivery } from '../reports/report-sharing.entity';
import { ReportSharingService } from '../reports/report-sharing.service';
import { McpScope } from './config';
import { mcpError } from './mcp-server';
import { McpOAuthPrincipal, McpOAuthService } from './mcp-oauth.service';

export const REPORT_PAGE_UNITS = 20000;
const COMMENT_PAGE_BYTES = 192 * 1024;

export type McpAnchorInput =
  | { kind: 'whole' }
  | { kind: 'text'; start: number; end: number }
  | { kind: 'image'; blockId: string };
type Range = { start: number; end: number };
type ShareOutcome = {
  recipientUserId: string;
  outcome: 'shared' | 'replayed' | 'failed' | 'notAttempted';
  relationVersion?: number;
  pinnedVersion?: number | null;
  error?: ReturnType<typeof mcpError>;
};

/** Deterministic per-recipient share request ID, so retrying one MCP requestId never duplicates. */
export function shareRequestId(requestId: string, recipientId: number) {
  const hex = createHash('sha256')
    .update(`vm-mcp-share\0${requestId}\0${recipientId}`)
    .digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
}

@Injectable()
export class McpReportService {
  constructor(
    private readonly db: DataSource,
    private readonly sharing: ReportSharingService,
    private readonly comments: ReportCommentService,
    private readonly auth: McpOAuthService,
  ) {}

  private actor(principal: McpOAuthPrincipal) {
    return { id: principal.actorId, authVersion: principal.authVersion };
  }

  private view(principal: McpOAuthPrincipal, reportId: string) {
    return sourceWriteTransaction(this.db, async manager => {
      const access = await this.sharing.access(manager, reportId, this.actor(principal));
      if (access.head.organizationKey !== principal.organizationId) throw new ForbiddenException();
      return access;
    });
  }

  private write(principal: McpOAuthPrincipal, scope: McpScope): CommentWriteOptions {
    return {
      beforeAccess: async manager => {
        await this.auth.assertGrant(manager, principal, scope);
      },
      ai: { grantId: principal.grantId, clientName: principal.clientName },
    };
  }

  /** Canonical text anchor in the viewer's version; Claude supplies only the range. */
  private async anchor(
    principal: McpOAuthPrincipal,
    reportId: string,
    version: number,
    range: Range,
  ) {
    const access = await this.view(principal, reportId);
    if (version !== access.version)
      throw new ConflictException(
        `You can see version ${access.version}; re-read the report and use its offsets.`,
      );
    const text = documentText(access.report.blocks, access.report.body);
    if (range.start >= range.end || range.end > text.length)
      throw new BadRequestException(
        `start must be below end and end at most ${text.length} (UTF-16 code units).`,
      );
    const anchor = textAnchorAt(text, range.start, range.end);
    const problem = textAnchorProblem(anchor, text);
    if (problem)
      throw new BadRequestException(
        problem === 'surrogate'
          ? 'start or end splits a surrogate pair.'
          : problem === 'quote-length'
          ? 'The range must be 1-2000 UTF-16 code units; include nearby words instead.'
          : 'The range is not valid for this version.',
      );
    return anchor;
  }

  /**
   * The text anchor a committed write with this requestId stored, or null for a new requestId.
   * anchor() checks the range against the current version, which fails once the report has moved
   * on even though the first call committed; a retry reuses the stored anchor instead. Only the
   * operation and range are checked here; the write then compares the full payload hash (version,
   * stored anchor, body, replacement, ...) under lock, so other changed input is REQUEST_REUSED too.
   * The organization check of view() runs first: replay() itself does not compare the report's
   * organization with the grant's.
   */
  private async storedAnchor(
    principal: McpOAuthPrincipal,
    reportId: string,
    requestId: string,
    operation: CommentOperation,
    range: Range,
  ): Promise<ReportTextAnchor | null> {
    await this.view(principal, reportId);
    const prior = await this.comments.replay(reportId, requestId, this.actor(principal));
    if (!prior) return null;
    const anchor =
      prior.operation !== operation
        ? undefined
        : operation === 'thread.create'
        ? prior.thread.anchor
        : prior.thread.suggestions.find(suggestion => suggestion.id === prior.resultId)?.anchor;
    if (anchor?.kind !== 'text' || anchor.start !== range.start || anchor.end !== range.end)
      throw new RequestReusedException(
        'This requestId was already used with different input.',
        prior.resultId,
        prior.thread.id,
      );
    return anchor;
  }

  list(principal: McpOAuthPrincipal, after?: string) {
    return this.sharing.library(this.actor(principal), after).then(page => ({
      reports: page.items.map(({ id, title, version, updatedAt, ownership }) => ({
        reportId: id,
        title,
        version,
        updatedAt,
        ownership,
      })),
      nextCursor: page.nextCursor,
    }));
  }

  async read(principal: McpOAuthPrincipal, reportId: string, offset: number) {
    const { report, version, role } = await this.view(principal, reportId);
    const text = documentText(report.blocks, report.body);
    if (offset > text.length || splitsSurrogate(text, offset))
      throw new BadRequestException(
        `offset must be at most ${text.length} and must not split a surrogate pair.`,
      );
    let end = Math.min(text.length, offset + REPORT_PAGE_UNITS);
    if (splitsSurrogate(text, end)) end -= 1;
    const frozen = (report.snapshot?.rendered?.blocks ?? []) as Array<{
      title?: unknown;
      kind?: unknown;
    }>;
    return {
      reportId,
      title: report.title,
      version,
      role,
      savedAt: report.savedAt,
      documentText: {
        unit: 'utf16' as const,
        offset,
        end,
        totalLength: text.length,
        nextOffset: end < text.length ? end : null,
        text: text.slice(offset, end),
      },
      images: (report.blocks ?? []).flatMap(block =>
        block.kind === 'IMAGE' ? [{ blockId: block.id, alt: block.alt }] : [],
      ),
      frozenBlocks: frozen.map(block => ({
        title: typeof block.title === 'string' ? block.title : '',
        kind: block.kind === 'BOARD_NUMERIC' ? ('kpi' as const) : ('chart' as const),
      })),
    };
  }

  async threads(principal: McpOAuthPrincipal, reportId: string, threadOffset: number) {
    const result = await this.comments.list(reportId, this.actor(principal));
    const page: typeof result.threads = [];
    let bytes = 0;
    for (const thread of result.threads.slice(threadOffset)) {
      const size = Buffer.byteLength(JSON.stringify(thread));
      if (page.length && bytes + size > COMMENT_PAGE_BYTES) break;
      page.push(thread);
      bytes += size;
    }
    const next = threadOffset + page.length;
    return {
      reportId,
      role: result.role,
      version: result.version,
      threadOffset,
      totalThreads: result.threads.length,
      nextThreadOffset: next < result.threads.length ? next : null,
      threads: page,
    };
  }

  async addComment(
    principal: McpOAuthPrincipal,
    input: {
      reportId: string;
      version: number;
      anchor: McpAnchorInput;
      body: string;
      requestId: string;
    },
  ) {
    const anchor =
      input.anchor.kind === 'text'
        ? (await this.storedAnchor(
            principal,
            input.reportId,
            input.requestId,
            'thread.create',
            input.anchor,
          )) ?? (await this.anchor(principal, input.reportId, input.version, input.anchor))
        : input.anchor;
    return this.comments.createThread(
      input.reportId,
      { requestId: input.requestId, version: input.version, anchor, body: input.body },
      this.actor(principal),
      this.write(principal, 'comments:write'),
    );
  }

  reply(
    principal: McpOAuthPrincipal,
    input: { reportId: string; threadId: string; body: string; requestId: string },
  ) {
    return this.comments.reply(
      input.reportId,
      input.threadId,
      { requestId: input.requestId, body: input.body },
      this.actor(principal),
      this.write(principal, 'comments:write'),
    );
  }

  async propose(
    principal: McpOAuthPrincipal,
    input: Range & {
      reportId: string;
      version: number;
      threadId?: string;
      replacement: string;
      rationale?: string;
      body?: string;
      requestId: string;
    },
  ) {
    const anchor =
      (await this.storedAnchor(
        principal,
        input.reportId,
        input.requestId,
        'suggestion.create',
        input,
      )) ?? (await this.anchor(principal, input.reportId, input.version, input));
    return this.comments.createSuggestion(
      input.reportId,
      {
        requestId: input.requestId,
        version: input.version,
        ...(input.threadId === undefined ? {} : { threadId: input.threadId }),
        anchor,
        replacement: input.replacement,
        ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
        ...(input.body === undefined ? {} : { body: input.body }),
      },
      this.actor(principal),
      this.write(principal, 'suggestions:write'),
    );
  }

  /** Owner-only: current recipients by login ID and same-organization candidates. */
  async shares(principal: McpOAuthPrincipal, reportId: string, query = '') {
    const actor = this.actor(principal);
    const recipients: Array<{
      recipientUserId: string | null;
      status: 'active' | 'suspended' | 'revoked';
      active: boolean;
      relationVersion: number;
      pinnedVersion: number;
      sharedBy?: { kind: 'ai'; clientName: string };
    }> = [];
    let after: string | undefined;
    let head: Awaited<ReturnType<ReportSharingService['shares']>>;
    for (let page = 0; page < 5; page += 1) {
      head = await this.sharing.shares(reportId, actor, after);
      if (head.organizationId !== principal.organizationId) throw new ForbiddenException();
      for (const item of head.items)
        recipients.push({
          recipientUserId: item.userId,
          status: item.status,
          active: item.active,
          relationVersion: item.relationVersion,
          pinnedVersion: item.pinnedVersion,
          ...(item.sharedBy ? { sharedBy: item.sharedBy } : {}),
        });
      if (head.nextCursor === null) break;
      after = String(head.nextCursor);
    }
    const peers = await this.sharing.peers(reportId, actor, { q: query });
    return {
      reportId,
      headVersion: head.headVersion,
      canShare: head.canShare,
      recipients,
      moreRecipients: head.nextCursor !== null,
      candidates: peers.items.map(({ userId, team }) => ({ userId, team })),
      moreCandidates: peers.nextCursor !== null,
    };
  }

  /** Resolves login IDs to active members of the approved organization (never the owner). */
  private async owned(principal: McpOAuthPrincipal, reportId: string, loginIds: string[]) {
    return sourceWriteTransaction(this.db, async manager => {
      const access = await this.sharing.access(manager, reportId, this.actor(principal));
      if (access.head.organizationKey !== principal.organizationId || access.role !== 'owner')
        throw new ForbiddenException();
      const recipients: Array<{ loginId: string; id: number }> = [];
      for (const loginId of loginIds) {
        const user = await manager.findOne(User, {
          where: { userId: loginId },
          select: { id: true, userId: true, active: true },
        });
        const member = user && (await manager.findOneBy(EnterpriseMembership, { userId: user.id }));
        if (
          !user?.active ||
          user.id === principal.actorId ||
          member?.organizationId !== principal.organizationId ||
          !['admin', 'member'].includes(member.role)
        )
          throw new BadRequestException(
            `"${loginId.slice(
              0,
              64,
            )}" is not another active member of this organization. Use a login ID from vm_list_report_shares candidates.`,
          );
        recipients.push({ loginId, id: user.id });
      }
      return { head: access.head, recipients };
    });
  }

  async share(
    principal: McpOAuthPrincipal,
    input: {
      reportId: string;
      recipientUserIds: string[];
      expectedHeadVersion: number;
      requestId: string;
    },
  ) {
    if (new Set(input.recipientUserIds).size !== input.recipientUserIds.length)
      throw new BadRequestException('recipientUserIds must not repeat a login ID.');
    const actor = this.actor(principal);
    const { head, recipients } = await this.owned(
      principal,
      input.reportId,
      input.recipientUserIds,
    );
    const planned = [];
    for (const recipient of recipients) {
      const requestId = shareRequestId(input.requestId, recipient.id);
      const prior = await this.sharing.outcome(input.reportId, requestId, actor);
      if (
        prior.status === 'committed' &&
        (prior.receipt.operation !== 'share' ||
          prior.receipt.recipientId !== recipient.id ||
          prior.receipt.pinnedVersion !== input.expectedHeadVersion)
      )
        throw new RequestReusedException('This requestId was already used with different input.');
      planned.push({ ...recipient, requestId, prior });
    }
    if (
      planned.some(item => item.prior.status === 'missing') &&
      head.version !== input.expectedHeadVersion
    )
      throw new ConflictException(
        `The latest saved version is ${head.version}; review it with vm_read_report before sharing.`,
      );
    const results: ShareOutcome[] = [];
    let failed = false;
    for (const item of planned) {
      if (failed) {
        results.push({ recipientUserId: item.loginId, outcome: 'notAttempted' });
        continue;
      }
      if (item.prior.status === 'committed') {
        const { relationVersion, pinnedVersion } = item.prior.receipt;
        results.push({
          recipientUserId: item.loginId,
          outcome: 'replayed',
          relationVersion,
          pinnedVersion,
        });
        continue;
      }
      try {
        const relation = await this.db.manager.findOneBy(ReportDelivery, {
          reportId: input.reportId,
          recipientId: item.id,
        });
        const { receipt, replayed } = await this.sharing.change(
          input.reportId,
          {
            requestId: item.requestId,
            expectedOrganizationId: principal.organizationId,
            recipientId: item.id,
            expectedRelationVersion: relation?.relationVersion ?? 0,
            operation: { kind: 'share', expectedHeadRevision: head.revision },
          },
          actor,
          {
            beforeAccess: manager =>
              this.auth.assertGrant(manager, principal, 'shares:write').then(() => undefined),
            ai: { grantId: principal.grantId, clientName: principal.clientName },
          },
        );
        results.push({
          recipientUserId: item.loginId,
          outcome: replayed ? 'replayed' : 'shared',
          relationVersion: receipt.relationVersion,
          pinnedVersion: receipt.pinnedVersion,
        });
      } catch (error) {
        if (!results.some(result => result.outcome === 'shared' || result.outcome === 'replayed'))
          throw error;
        failed = true;
        results.push({ recipientUserId: item.loginId, outcome: 'failed', error: mcpError(error) });
      }
    }
    return {
      reportId: input.reportId,
      sharedVersion: input.expectedHeadVersion,
      complete: !failed,
      ...(failed
        ? {
            note: 'Some recipients were shared and others were not. Retry with the same requestId and input to finish; shared recipients are not shared twice.',
          }
        : {}),
      recipients: results,
    };
  }
}
