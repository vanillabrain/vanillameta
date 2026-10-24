import { AiController } from '../../ai/ai.controller';
import { BiController } from '../../bi/bi.controller';
import { FileSchemaImpactController } from '../../bi/file-schema-impact.controller';
import { GovernanceController } from '../../bi/governance.controller';
import { SemanticProposalController } from '../../bi/semantic-proposal.controller';
import { CommerceController } from '../../commerce/commerce.controller';
import { StudioCreationController } from '../../dashboard-studio/studio-creation.controller';
import { StudioExecutionController } from '../../dashboard-studio/studio-execution.controller';
import { StudioRunController } from '../../dashboard-studio/studio-run.controller';
import { DatabaseController } from '../../database/database.controller';
import { FileRefreshController } from '../../database/file-refresh.controller';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { USER_THROTTLE_KEY, UserThrottleGuard } from './user-throttle.guard';

type Preset = 'ai' | 'upload';
const preset = (target: any, handler?: string): Preset | undefined =>
  Reflect.getMetadata(USER_THROTTLE_KEY, handler ? target.prototype[handler] : target);
const guards = (target: any): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];

// Every AI-calling and file-uploading route, which the per-IP limit alone does not protect per user.
const WHOLE_CLASS: [string, any][] = [
  ['AiController', AiController],
  ['StudioCreationController', StudioCreationController],
  ['StudioRunController', StudioRunController],
  ['StudioExecutionController', StudioExecutionController],
  ['SemanticProposalController', SemanticProposalController],
  ['FileSchemaImpactController', FileSchemaImpactController],
];
const HANDLERS: [string, any, string, Preset][] = [
  ['commerce sample-help', CommerceController, 'sampleHelp', 'ai'],
  ['commerce import-help', CommerceController, 'importHelp', 'ai'],
  ['commerce :id/ai', CommerceController, 'aiDraft', 'ai'],
  ['commerce sources/:id/import', CommerceController, 'importBundle', 'upload'],
  ['commerce import', CommerceController, 'importNew', 'upload'],
  ['bi editor ai', BiController, 'editorAi', 'ai'],
  ['governance assistant', GovernanceController, 'assistant', 'ai'],
  ['database upload', DatabaseController, 'uploadFile', 'upload'],
  ['database file-replacement', DatabaseController, 'replaceFile', 'upload'],
  ['file-refresh start', FileRefreshController, 'start', 'upload'],
];

describe('per-user throttle coverage', () => {
  it.each(WHOLE_CLASS)('%s throttles every handler as AI', (_name, controller) => {
    expect(preset(controller)).toBe('ai');
  });

  it.each(HANDLERS)('%s is throttled as %s', (_name, controller, handler, expected) => {
    expect(preset(controller, handler)).toBe(expected);
  });

  it.each([...WHOLE_CLASS.map(([n, c]) => [n, c]), ...HANDLERS.map(([n, c]) => [n, c])])(
    '%s lists the throttle guard after JwtAuthGuard, so req.user exists when it runs',
    (_name, controller) => {
      const list = guards(controller);
      expect(list).toContain(UserThrottleGuard);
      expect(list.indexOf(JwtAuthGuard)).toBeGreaterThanOrEqual(0);
      expect(list.indexOf(UserThrottleGuard)).toBeGreaterThan(list.indexOf(JwtAuthGuard));
    },
  );

  it('leaves unrelated routes of a mixed controller alone', () => {
    expect(preset(CommerceController, 'importBundle')).toBe('upload');
    expect(preset(DatabaseController, 'testConnection')).toBeUndefined();
    expect(preset(FileRefreshController, 'cancel')).toBeUndefined();
  });
});
