export const CLAUDE_CLIENT_ID = 'claude-code';
export const CLAUDE_CALLBACK_PORT = '53683';
export const CLAUDE_MCP_SERVER_NAME = 'vanillameta';

export type ClaudeMcpCommand = {
  purpose: 'register' | 'login';
  command: string;
};

const shellQuote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

export function claudeMcpCommands(resourceUrl: string | null): ClaudeMcpCommand[] {
  if (!resourceUrl) return [];
  try {
    const url = new URL(resourceUrl);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || url.hash) return [];
    return [
      {
        purpose: 'register',
        command: `claude mcp add --transport http --client-id ${CLAUDE_CLIENT_ID} --callback-port ${CLAUDE_CALLBACK_PORT} ${CLAUDE_MCP_SERVER_NAME} --scope local ${shellQuote(
          url.href,
        )}`,
      },
      {
        purpose: 'login',
        command: claudeLoginCommand(),
      },
    ];
  } catch {
    return [];
  }
}

export function claudeLoginCommand() {
  return `claude mcp login ${CLAUDE_MCP_SERVER_NAME} --no-browser`;
}
