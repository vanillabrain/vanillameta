import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { User } from '../user/entities/user.entity';
import { sourceWriteTransaction } from '../database/source-write-lock';
import {
  documentText,
  splitsSurrogate,
  textAnchorAt,
  textAnchorProblem,
} from '../reports/report-anchor';
import {
  COMMENT_LIMITS,
  CommentOperation,
  CommentWriteResult,
  ReportTextAnchor,
} from '../reports/report-comment-contract';
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
import { isMemberRole, roleAllows } from '../enterprise/role-capabilities';
import { MCP_SCOPE_POLICY } from './scope-policy';

export const REPORT_PAGE_UNITS = 20000;
const COMMENT_PAGE_BYTES = 192 * 1024;

/** A text range by UTF-16 offsets or by an exact quote (occurrence is 1-based). */
export type McpTextTarget = { start?: number; end?: number; quote?: string; occurrence?: number };
export type McpAnchorInput =
  | { kind: 'whole' }
  | ({ kind: 'text' } & McpTextTarget)
  | { kind: 'image'; blockId: string };
type Range = { start: number; end: number };
type Target = Range | { quote: string; occurrence?: number };
const SEPARATOR = '\n\n';

function textTarget(input: McpTextTarget): Target {
  const { start, end, quote, occurrence } = input;
  const byRange = start !== undefined || end !== undefined;
  if (byRange === (quote !== undefined || occurrence !== undefined))
    throw new BadRequestException(
      'Give either quote (with optional occurrence) or start and end, not both.',
    );
  if (byRange) {
    if (start === undefined || end === undefined)
      throw new BadRequestException('start and end are both required for an offset range.');
    return { start, end };
  }
  if (!quote) throw new BadRequestException('occurrence needs a quote.');
  return occurrence === undefined ? { quote } : { quote, occurrence };
}

/** More matches than this are not counted: the message says "100+" and asks for an occurrence. */
const QUOTE_MATCH_CAP = 100;

/**
 * The range of the chosen exact match; a match that would split a surrogate pair is skipped. The
 * scan ends at the requested occurrence, or past QUOTE_MATCH_CAP matches when none is requested,
 * so a repetitive document cannot make one call scan and count every match.
 */
export function quoteRange(text: string, version: number, quote: string, occurrence?: number) {
  const limit = occurrence ?? QUOTE_MATCH_CAP + 1;
  let count = 0;
  let chosen = -1;
  let at = text.indexOf(quote);
  while (at !== -1 && count < limit) {
    if (!splitsSurrogate(text, at) && !splitsSurrogate(text, at + quote.length)) {
      count += 1;
      chosen = at;
    }
    if (count < limit) at = text.indexOf(quote, at + 1);
  }
  if (!count)
    throw new BadRequestException(
      `quote is not in version ${version}. Copy it exactly (case, spaces, line breaks) from vm_read_report.`,
    );
  if (occurrence === undefined && count > 1)
    throw new BadRequestException(
      count > QUOTE_MATCH_CAP
        ? 'quote matches 100+ places. Pass occurrence (document order) or quote more text.'
        : `quote matches ${count} places. Pass occurrence 1-${count} (document order) or quote more text.`,
    );
  if (occurrence !== undefined && count < occurrence)
    throw new BadRequestException(
      `occurrence ${occurrence} is out of range: quote matches ${count} place(s).`,
    );
  return { start: chosen, end: chosen + quote.length };
}

/**
 * Deleting a whole paragraph also deletes one adjacent blank-line separator (the following one,
 * else the preceding one), so no empty paragraph is left. Unchanged when that would exceed the
 * quote limit.
 */
export function widenParagraphDeletion(text: string, range: Range): Range {
  const { start, end } = range;
  const whole =
    (start === 0 || text.slice(start - 2, start) === SEPARATOR) &&
    (end === text.length || text.slice(end, end + 2) === SEPARATOR);
  if (!whole || end - start + SEPARATOR.length > COMMENT_LIMITS.quote) return range;
  if (end < text.length) return { start, end: end + SEPARATOR.length };
  if (start > 0) return { start: start - SEPARATOR.length, end };
  return range;
}
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

  /**
   * The grade bounds what a connection may write, whatever scope the user approved: an AI acts with
   * the account's own rights, never more. A viewer's connection cannot comment or share even if it
   * holds the scope. The grade is read on every write, so a demotion applies at once (it does not
   * bump authVersion, so the token stays valid).
   */
  private async assertGrade(manager: EntityManager, principal: McpOAuthPrincipal, scope: McpScope) {
    const { capability } = MCP_SCOPE_POLICY[scope];
    const member = await manager.findOneBy(EnterpriseMembership, {
      userId: principal.actorId,
      organizationId: principal.organizationId,
    });
    if (!member || !roleAllows(member.role, capability)) throw new ForbiddenException();
  }

  /** Share writes take their own options type, which requires the AI attribution. */
  private shareWrite(principal: McpOAuthPrincipal): Parameters<ReportSharingService['change']>[3] {
    return {
      beforeAccess: async manager => {
        await this.auth.assertGrant(manager, principal, 'shares:write');
        await this.assertGrade(manager, principal, 'shares:write');
      },
      ai: { grantId: principal.grantId, clientName: principal.clientName },
    };
  }

  private write(principal: McpOAuthPrincipal, scope: McpScope): CommentWriteOptions {
    return {
      beforeAccess: async manager => {
        await this.auth.assertGrant(manager, principal, scope);
        await this.assertGrade(manager, principal, scope);
      },
      ai: { grantId: principal.grantId, clientName: principal.clientName },
    };
  }

  /**
   * Canonical text anchor in the viewer's version; Claude supplies only a range or a quote.
   * A committed write with this requestId keeps its stored anchor instead: re-resolving fails or
   * moves once the report was saved again, although the first call committed. The organization
   * check of view() runs before replay(), which does not compare organizations itself. write() then
   * compares the full payload hash (version, stored anchor, body, replacement, ...) under lock.
   */
  private async textAnchor(
    principal: McpOAuthPrincipal,
    input: { reportId: string; version: number; requestId: string },
    operation: CommentOperation,
    target: Target,
    deletion: boolean,
  ): Promise<{ anchor: ReportTextAnchor; widened: boolean }> {
    const access = await this.view(principal, input.reportId);
    const text = documentText(access.report.blocks, access.report.body);
    const prior = await this.comments.replay(
      input.reportId,
      input.requestId,
      this.actor(principal),
    );
    if (prior)
      return this.storedAnchor(
        prior,
        operation,
        target,
        input.version === access.version ? text : null,
        deletion,
      );
    if (input.version !== access.version)
      throw new ConflictException(
        `You can see version ${access.version}; re-read the report and anchor in that version.`,
      );
    const range =
      'quote' in target
        ? quoteRange(text, access.version, target.quote, target.occurrence)
        : target;
    if (range.start >= range.end || range.end > text.length)
      throw new BadRequestException(
        `start must be below end and end at most ${text.length} (UTF-16 code units).`,
      );
    const chosen = deletion ? widenParagraphDeletion(text, range) : range;
    const anchor = textAnchorAt(text, chosen.start, chosen.end);
    const problem = textAnchorProblem(anchor, text);
    if (problem)
      throw new BadRequestException(
        problem === 'surrogate'
          ? 'start or end splits a surrogate pair.'
          : problem === 'quote-length'
          ? 'The range must be 1-2000 UTF-16 code units; include nearby words instead.'
          : 'The range is not valid for this version.',
      );
    return { anchor, widened: chosen !== range };
  }

  /**
   * The anchor the earlier write stored, when this input resolves to it. In the same version the
   * input is resolved again and compared by range. After a newer save the earlier text is not at
   * hand: offsets are compared with the stored range and a quote with the stored quote, so a
   * changed occurrence alone is not detected there.
   *
   * Widening is reported only when the input is narrower than the stored anchor. Retrying with the
   * already-widened text ("paragraph\n\n") cannot be told from a first call that sent exactly that
   * text, which is never widened and returns no widenedForParagraph; the stored suggestion does not
   * record whether it was widened, so that retry replays without the flag.
   */
  private storedAnchor(
    prior: CommentWriteResult,
    operation: CommentOperation,
    target: Target,
    text: string | null,
    deletion: boolean,
  ) {
    const anchor =
      prior.operation !== operation
        ? undefined
        : operation === 'thread.create'
        ? prior.thread.anchor
        : prior.thread.suggestions.find(suggestion => suggestion.id === prior.resultId)?.anchor;
    const reused = () =>
      new RequestReusedException(
        'This requestId was already used with different input.',
        prior.resultId,
        prior.thread.id,
      );
    if (anchor?.kind !== 'text') throw reused();
    const at = (range: Range) => anchor.start === range.start && anchor.end === range.end;
    let exact: boolean, widened: boolean;
    if (text !== null) {
      let range: Range;
      try {
        range = 'quote' in target ? quoteRange(text, 0, target.quote, target.occurrence) : target;
      } catch {
        throw reused();
      }
      exact = at(range);
      widened = deletion && !exact && at(widenParagraphDeletion(text, range));
    } else if ('quote' in target) {
      exact = anchor.quote === target.quote;
      widened =
        deletion && [target.quote + SEPARATOR, SEPARATOR + target.quote].includes(anchor.quote);
    } else {
      exact = at(target);
      widened =
        deletion &&
        ((at({ start: target.start, end: target.end + SEPARATOR.length }) &&
          anchor.quote.endsWith(SEPARATOR)) ||
          (at({ start: target.start - SEPARATOR.length, end: target.end }) &&
            anchor.quote.startsWith(SEPARATOR)));
    }
    if (!exact && !widened) throw reused();
    return { anchor, widened };
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
        ? (
            await this.textAnchor(
              principal,
              input,
              'thread.create',
              textTarget(input.anchor),
              false,
            )
          ).anchor
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
    input: McpTextTarget & {
      reportId: string;
      version: number;
      threadId?: string;
      replacement: string;
      rationale?: string;
      body?: string;
      requestId: string;
    },
  ) {
    const target = textTarget(input);
    const { anchor, widened } = await this.textAnchor(
      principal,
      input,
      'suggestion.create',
      target,
      input.replacement === '',
    );
    const result = await this.comments.createSuggestion(
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
    return widened ? { ...result, widenedForParagraph: true as const } : result;
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
          !isMemberRole(member.role)
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
        `Latest saved version is ${head.version}; review it with vm_read_report. For recipients not yet shared, check vm_list_report_shares, then use a new requestId.`,
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
          this.shareWrite(principal),
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
