import { spawn } from 'child_process';
import { mkdtemp, open, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export const CODEX_MODEL = 'gpt-6-luna';
const MAX_CONCURRENT = 2;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_STREAM_BYTES = 1024 * 1024;
let activeCalls = 0;

function connectionArgs(): string[] {
  const args: string[] = [];
  const base = process.env.AI_CODEX_BASE_URL;
  if (base) {
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      throw new Error('LLM_CODEX_INVALID_CONNECTION');
    }
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !(
        ['https:'].includes(url.protocol) ||
        (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      )
    )
      throw new Error('LLM_CODEX_INVALID_CONNECTION');
    args.push('-c', `openai_base_url=${JSON.stringify(base)}`);
  }
  const catalog = process.env.AI_CODEX_MODEL_CATALOG;
  if (catalog) args.push('-c', `model_catalog_json=${JSON.stringify(catalog)}`);
  return args;
}

/** Requires an installed Codex CLI and existing ChatGPT login; never falls back. */
export async function callCodingAgent(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
): Promise<string> {
  // POSIX process groups also terminate the native process behind the Node CLI launcher.
  if (process.platform === 'win32') throw new Error('LLM_CODEX_UNSUPPORTED_PLATFORM');
  const prompt = [
    'Answer using only the supplied context and question. No tools are needed; do not use tools, read files, or inspect the environment.',
    systemPrompt,
    jsonMode ? 'Return only a JSON object.' : '',
    userPrompt,
  ].join('\n\n');
  if (Buffer.byteLength(prompt) > MAX_OUTPUT_BYTES) throw new Error('LLM_PROMPT_TOO_LARGE');
  if (activeCalls >= MAX_CONCURRENT) throw new Error('LLM_CODEX_BUSY');
  activeCalls++;
  let directory: string;
  try {
    directory = await mkdtemp(join(tmpdir(), 'vanillameta-ai-'));
    const outputPath = join(directory, 'answer.txt');
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'HOME', 'CODEX_HOME']) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    const configuredTimeout = Number(process.env.AI_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? Math.min(configuredTimeout, 180000)
        : 120000;

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'codex',
        [
          'exec',
          '--ignore-user-config',
          '--ephemeral',
          '--skip-git-repo-check',
          '--sandbox',
          'read-only',
          '--model',
          CODEX_MODEL,
          ...connectionArgs(),
          '--output-last-message',
          outputPath,
          '-',
        ],
        { shell: false, detached: true, cwd: directory, env, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      let failure: Error;
      let streamBytes = 0;
      const stop = (message: string) => {
        if (failure) return;
        failure = new Error(message);
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      };
      const timeout = setTimeout(() => stop('LLM_CODEX_TIMEOUT'), timeoutMs);
      const countOutput = (chunk: Buffer) => {
        streamBytes += chunk.length;
        if (streamBytes > MAX_STREAM_BYTES) stop('LLM_CODEX_OUTPUT_TOO_LARGE');
      };
      child.stdout.on('data', countOutput);
      child.stderr.on('data', countOutput);
      child.stdin.on('error', () => stop('LLM_CODEX_STDIN_ERROR'));
      child.on('error', () => {
        failure = failure || new Error('LLM_CODEX_UNAVAILABLE');
      });
      // Retain the concurrency slot and temporary files until the process has stopped.
      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        if (failure) reject(failure);
        else if (code !== 0 || signal) reject(new Error('LLM_CODEX_EXIT_ERROR'));
        else resolve();
      });
      child.stdin.end(prompt);
    });

    let file: Awaited<ReturnType<typeof open>>;
    try {
      file = await open(outputPath, 'r');
    } catch {
      throw new Error('LLM_CODEX_MISSING_OUTPUT');
    }
    try {
      if ((await file.stat()).size > MAX_OUTPUT_BYTES) {
        throw new Error('LLM_CODEX_OUTPUT_TOO_LARGE');
      }
      const buffer = Buffer.alloc(MAX_OUTPUT_BYTES + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const chunk = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
        if (!chunk.bytesRead) break;
        bytesRead += chunk.bytesRead;
      }
      if (bytesRead > MAX_OUTPUT_BYTES) throw new Error('LLM_CODEX_OUTPUT_TOO_LARGE');
      const answer = buffer.subarray(0, bytesRead).toString('utf8').trim();
      if (!answer) throw new Error('LLM_EMPTY_RESPONSE');
      return answer;
    } finally {
      await file.close();
    }
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      activeCalls--;
    }
  }
}
