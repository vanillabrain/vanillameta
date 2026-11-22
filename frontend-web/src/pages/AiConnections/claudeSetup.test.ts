import { describe, expect, it } from 'vitest';
import { claudeMcpCommands } from './claudeSetup';

describe('Claude MCP setup commands', () => {
  it('uses the server URL exactly, including a custom port', () => {
    expect(claudeMcpCommands('http://localhost:4567/v1/mcp')).toEqual([
      {
        purpose: 'register',
        command:
          "claude mcp add --transport http --client-id claude-code --callback-port 53683 vanillameta --scope local 'http://localhost:4567/v1/mcp'",
      },
      { purpose: 'login', command: 'claude mcp login vanillameta --no-browser' },
    ]);
  });

  it.each([null, 'not a URL', 'javascript:alert(1)', 'https://user:secret@api.example/v1/mcp'])(
    'hides unsafe or missing input %s',
    value => {
      expect(claudeMcpCommands(value)).toEqual([]);
    },
  );
});
