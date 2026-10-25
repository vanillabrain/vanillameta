jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiController } from '../../ai/ai.controller';
import { BiController } from '../../bi/bi.controller';
import { FileSchemaImpactController } from '../../bi/file-schema-impact.controller';
import { GovernanceController } from '../../bi/governance.controller';
import { SemanticProposalController } from '../../bi/semantic-proposal.controller';
import { CommerceController } from '../../commerce/commerce.controller';
import { StudioCreationController } from '../../dashboard-studio/studio-creation.controller';
import { StudioExecutionController } from '../../dashboard-studio/studio-execution.controller';
import { StudioReceivedRemixController } from '../../dashboard-studio/studio-received-remix.controller';
import { StudioRemixController } from '../../dashboard-studio/studio-remix.controller';
import { StudioRunController } from '../../dashboard-studio/studio-run.controller';
import { DatabaseController } from '../../database/database.controller';
import { FileRefreshController } from '../../database/file-refresh.controller';
import { UsageController } from '../../usage/usage.controller';
import { USER_THROTTLE_KEY, UserThrottleGuard } from './user-throttle.guard';

type Preset = 'ai' | 'upload' | 'read' | 'remix';
const preset = (target: any, handler?: string): Preset | undefined =>
  Reflect.getMetadata(USER_THROTTLE_KEY, handler ? target.prototype[handler] : target);
const guards = (target: any): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];

// Routes that reach the model (callLlm) or write an uploaded file. The preset goes on these handlers
// only: the UI polls and re-queries the other routes of the same controllers, and a per-route limit
// there would show users a 429 in normal use (Studio run polling is one call every two seconds).
const THROTTLED: [string, any, string, Preset][] = [
  ['ai dashboard-draft', AiController, 'dashboardDraft', 'ai'],
  ['ai dashboard-assistant', AiController, 'dashboardAssistant', 'ai'],
  ['ai text-to-sql', AiController, 'textToSql', 'ai'],
  ['ai recommend-chart', AiController, 'recommendChart', 'ai'],
  ['ai dashboard-insight', AiController, 'dashboardInsight', 'ai'],
  ['studio proposals', StudioCreationController, 'propose', 'ai'],
  ['studio runs', StudioRunController, 'run', 'ai'],
  ['studio executions', StudioExecutionController, 'create', 'ai'],
  ['studio run retry', StudioExecutionController, 'retry', 'ai'],
  ['studio creation message', StudioExecutionController, 'creationMessage', 'ai'],
  ['studio creation clarify', StudioExecutionController, 'clarifyCreation', 'ai'],
  ['semantic proposal', SemanticProposalController, 'propose', 'ai'],
  ['semantic question', SemanticProposalController, 'question', 'ai'],
  ['file schema diagnosis', FileSchemaImpactController, 'diagnose', 'ai'],
  ['commerce sample-help', CommerceController, 'sampleHelp', 'ai'],
  ['commerce import-help', CommerceController, 'importHelp', 'ai'],
  ['commerce :id/ai', CommerceController, 'aiDraft', 'ai'],
  ['bi editor ai', BiController, 'editorAi', 'ai'],
  ['governance assistant', GovernanceController, 'assistant', 'ai'],
  ['commerce sources/:id/import', CommerceController, 'importBundle', 'upload'],
  ['commerce import', CommerceController, 'importNew', 'upload'],
  ['database upload', DatabaseController, 'uploadFile', 'upload'],
  ['database file-replacement', DatabaseController, 'replaceFile', 'upload'],
  ['file-refresh start', FileRefreshController, 'start', 'upload'],
  ['me usage (walks the user directories)', UsageController, 'usage', 'read'],
  ['studio remix template', StudioRemixController, 'template', 'read'],
  ['studio remix preview', StudioRemixController, 'preview', 'remix'],
  ['studio remix save', StudioRemixController, 'remix', 'remix'],
  ['studio received remix template', StudioReceivedRemixController, 'template', 'read'],
  ['studio received remix preview', StudioReceivedRemixController, 'preview', 'remix'],
  ['studio received remix save', StudioReceivedRemixController, 'save', 'remix'],
];

// Polled, re-queried or autosaved by the UI, and none of them calls the model: never throttled here.
const LEFT_ALONE: [string, any, string][] = [
  ['ai status (read by screens)', AiController, 'status'],
  ['studio runs list (polled every 2s)', StudioExecutionController, 'list'],
  ['studio run get (polled)', StudioExecutionController, 'get'],
  ['studio run cancel', StudioExecutionController, 'cancel'],
  ['studio run remix save', StudioExecutionController, 'remix'],
  ['studio creation proposal read', StudioExecutionController, 'creationProposal'],
  ['studio creation save', StudioExecutionController, 'saveCreation'],
  ['studio sample', StudioCreationController, 'sample'],
  ['studio proposal read', StudioCreationController, 'proposal'],
  ['studio dashboard create', StudioCreationController, 'create'],
  ['ai dashboard-view (every filter change)', AiController, 'dashboardView'],
  ['ai dashboard-preview', AiController, 'dashboardPreview'],
  ['ai dashboard-save', AiController, 'dashboardSave'],
  ['ai metric-change/save', AiController, 'metricChangeSave'],
  ['semantic proposal save', SemanticProposalController, 'save'],
  ['semantic proposal preview', SemanticProposalController, 'preview'],
  ['file schema inspect', FileSchemaImpactController, 'inspect'],
  ['database test connection', DatabaseController, 'testConnection'],
  ['file-refresh cancel', FileRefreshController, 'cancel'],
  ['studio received reference (cheap lookup)', StudioReceivedRemixController, 'reference'],
  ['studio received remix-result (receipt lookup)', StudioReceivedRemixController, 'result'],
];

const CONTROLLERS = [
  AiController,
  BiController,
  CommerceController,
  DatabaseController,
  FileRefreshController,
  FileSchemaImpactController,
  GovernanceController,
  SemanticProposalController,
  StudioCreationController,
  StudioExecutionController,
  StudioReceivedRemixController,
  StudioRemixController,
  StudioRunController,
  UsageController,
];

describe('per-user throttle coverage', () => {
  it.each(THROTTLED)('%s is throttled as %s', (_name, controller, handler, expected) => {
    expect(controller.prototype[handler]).toBeDefined();
    expect(preset(controller, handler)).toBe(expected);
  });

  it.each(LEFT_ALONE)('%s is not throttled', (_name, controller, handler) => {
    expect(controller.prototype[handler]).toBeDefined();
    expect(preset(controller, handler)).toBeUndefined();
  });

  it.each(CONTROLLERS.map(controller => [controller.name, controller]))(
    '%s sets no class-wide preset and lists the throttle guard after JwtAuthGuard',
    (_name, controller) => {
      expect(preset(controller)).toBeUndefined();
      const list = guards(controller);
      expect(list).toContain(UserThrottleGuard);
      // StudioPublicationGuard (Studio publication routes) extends JwtAuthGuard and sets the user.
      const auth = list.findIndex(
        guard =>
          guard === JwtAuthGuard ||
          (typeof guard === 'function' && guard.prototype instanceof JwtAuthGuard),
      );
      expect(auth).toBeGreaterThanOrEqual(0);
      expect(list.indexOf(UserThrottleGuard)).toBeGreaterThan(auth);
    },
  );
});
