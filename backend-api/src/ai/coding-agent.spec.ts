import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import { access, writeFile } from 'fs/promises';
import { callCodingAgent } from './coding-agent';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

describe('Codex coding agent', () => {
  const originalEnv = { ...process.env };
  const spawnMock = spawn as jest.Mock;
  let children: any[];
  let options: any[];
  let args: string[][];
  let behavior: (child: any, outputPath: string) => Promise<void>;

  beforeEach(() => {
    children = [];
    options = [];
    args = [];
    process.env.AI_TIMEOUT_MS = '1000';
    delete process.env.AI_CODEX_BASE_URL;
    delete process.env.AI_CODEX_MODEL_CATALOG;
    behavior = async (child, outputPath) => {
      await writeFile(outputPath, ' SELECT 1 ');
      child.emit('close', 0, null);
    };
    spawnMock.mockReset().mockImplementation((_command, argv, opts) => {
      const child: any = new EventEmitter();
      child.stdin = new PassThrough();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = jest.fn(() => {
        setImmediate(() => child.emit('close', null, 'SIGKILL'));
        return true;
      });
      child.prompt = '';
      child.stdin.on('data', chunk => (child.prompt += chunk.toString()));
      child.stdin.on('finish', () => {
        void behavior(child, argv[argv.indexOf('--output-last-message') + 1]);
      });
      children.push(child);
      args.push(argv);
      options.push(opts);
      return child;
    });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    for (const opts of options) {
      await expect(access(opts.cwd)).rejects.toMatchObject({ code: 'ENOENT' });
    }
  });

  it('uses stdin, isolated cwd, required flags, pinned model, and only allowed environment', async () => {
    process.env.AI_API_KEY = 'must-not-pass';
    process.env.DB_PASSWORD = 'must-not-pass';
    process.env.OPENAI_API_KEY = 'must-not-pass';
    process.env.AI_MODEL = 'must-not-use';
    process.env.CODEX_HOME = '/existing/login/home';
    expect(await callCodingAgent('Schema: users(id)', 'Count users', true)).toBe('SELECT 1');
    expect(spawnMock).toHaveBeenCalledWith('codex', args[0], options[0]);
    expect(args[0]).toEqual([
      'exec',
      '--ignore-user-config',
      '--ephemeral',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--model',
      'gpt-6-luna',
      '--output-last-message',
      `${options[0].cwd}/answer.txt`,
      '-',
    ]);
    expect(options[0]).toMatchObject({ shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    expect(options[0].detached).toBe(true);
    expect(options[0].cwd).not.toBe(process.cwd());
    expect(Object.keys(options[0].env).sort()).toEqual(
      ['PATH', 'HOME', 'CODEX_HOME'].filter(key => process.env[key] !== undefined).sort(),
    );
    expect(options[0].env.CODEX_HOME).toBe('/existing/login/home');
    expect(children[0].prompt).toContain('No tools are needed');
    expect(children[0].prompt).toContain('Schema: users(id)');
    expect(children[0].prompt).toContain('Count users');
    expect(children[0].prompt).toContain('Return only a JSON object.');
  });

  it('passes only explicit connection settings without loading the global config or changing model', async () => {
    process.env.AI_CODEX_BASE_URL = 'http://127.0.0.1:10100/v1';
    process.env.AI_CODEX_MODEL_CATALOG = '/existing/model-catalog.json';
    await callCodingAgent('public schema', 'question');
    expect(args[0]).toContain('openai_base_url="http://127.0.0.1:10100/v1"');
    expect(args[0]).toContain('model_catalog_json="/existing/model-catalog.json"');
    expect(args[0]).toContain('--ignore-user-config');
    expect(args[0][args[0].indexOf('--model') + 1]).toBe('gpt-6-luna');
    expect(options[0].env).not.toHaveProperty('AI_CODEX_BASE_URL');
  });

  it('rejects credential-bearing connection URLs without spawning', async () => {
    process.env.AI_CODEX_BASE_URL = 'https://user:secret@example.com/v1';
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow(
      'LLM_CODEX_INVALID_CONNECTION',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it.each([1, null])('rejects unsuccessful exit %s even with an answer', async code => {
    behavior = async (child, path) => {
      await writeFile(path, 'SELECT 1');
      child.emit('close', code, code === null ? 'SIGTERM' : null);
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_CODEX_EXIT_ERROR');
  });

  it('rejects missing CLI without leaking process diagnostics', async () => {
    behavior = async child => {
      child.emit('error', new Error('ENOENT secret diagnostic'));
      child.emit('close', -2, null);
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_CODEX_UNAVAILABLE');
  });

  it('cleans up after synchronous spawn failure', async () => {
    spawnMock.mockImplementationOnce((_command, _args, opts) => {
      options.push(opts);
      throw new Error('spawn failed');
    });
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('spawn failed');
  });

  it('rejects missing output rather than returning stdout', async () => {
    behavior = async child => {
      child.stdout.write('SELECT 1');
      child.emit('close', 0, null);
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_CODEX_MISSING_OUTPUT');
  });

  it.each(['', ' \n\t'])('rejects empty output %j', async answer => {
    behavior = async (child, path) => {
      await writeFile(path, answer);
      child.emit('close', 0, null);
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_EMPTY_RESPONSE');
  });

  it('rejects oversized final output', async () => {
    behavior = async (child, path) => {
      await writeFile(path, 'a'.repeat(65537));
      child.emit('close', 0, null);
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow(
      'LLM_CODEX_OUTPUT_TOO_LARGE',
    );
  });

  it('kills a process exceeding the combined stdout/stderr limit', async () => {
    behavior = async child => {
      child.stdout.write(Buffer.alloc(512 * 1024));
      child.stderr.write(Buffer.alloc(512 * 1024 + 1));
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow(
      'LLM_CODEX_OUTPUT_TOO_LARGE',
    );
    expect(children[0].kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('kills a process on stdin failure', async () => {
    behavior = async child => {
      child.stdin.emit('error', new Error('broken pipe'));
    };
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_CODEX_STDIN_ERROR');
    expect(children[0].kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('kills and rejects on timeout', async () => {
    process.env.AI_TIMEOUT_MS = '10';
    behavior = async () => undefined;
    await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_CODEX_TIMEOUT');
    expect(children[0].kill).toHaveBeenCalledWith('SIGKILL');
  });

  it.each(['abort', 'timeout'])(
    'handles %s winning a deadline race and permits recovery',
    async winner => {
      process.env.AI_TIMEOUT_MS = '10';
      const controller = new AbortController();
      behavior = async child => {
        child.kill.mockImplementation(() => {
          // Timeout and HTTP disconnect may arrive before the child has closed.
          controller.abort();
          setTimeout(() => child.emit('close', null, 'SIGKILL'), 30);
          return true;
        });
        if (winner === 'abort') controller.abort();
      };
      await expect(callCodingAgent('schema', 'race', false, controller.signal)).rejects.toThrow(
        winner === 'abort' ? 'LLM_REQUEST_ABORTED' : 'LLM_CODEX_TIMEOUT',
      );
      expect(children[0].kill).toHaveBeenCalledTimes(1);
      process.env.AI_TIMEOUT_MS = '1000';
      behavior = async (child, outputPath) => {
        await writeFile(outputPath, 'recovered');
        child.emit('close', 0, null);
      };
      expect(await callCodingAgent('schema', 'retry')).toBe('recovered');
    },
  );

  it('rejects an already-aborted request without spawning', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(callCodingAgent('schema', 'question', false, controller.signal)).rejects.toThrow(
      'LLM_REQUEST_ABORTED',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('kills the process group on abort and retains its slot until close', async () => {
    behavior = async child => {
      child.pid = 123457;
    };
    const controller = new AbortController();
    const kill = jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(pid).toBe(-123457);
      expect(signal).toBe('SIGKILL');
      return true;
    });
    try {
      const pending = callCodingAgent('schema', 'question', false, controller.signal);
      const occupyingSlot = callCodingAgent('schema', 'occupy');
      while (children.length === 0 || !children[0].pid)
        await new Promise(resolve => setImmediate(resolve));
      while (children.length < 2) await new Promise(resolve => setImmediate(resolve));
      // Temporary-directory creation can resolve in either order. Identify the
      // aborted request by its prompt, never by the order spawn was called.
      while (children.some(child => !child.prompt || !child.pid))
        await new Promise(resolve => setImmediate(resolve));
      const abortedIndex = children.findIndex(child => child.prompt.endsWith('\n\nquestion'));
      const occupyingIndex = children.findIndex(child => child.prompt.endsWith('\n\noccupy'));
      expect(abortedIndex).toBeGreaterThanOrEqual(0);
      expect(occupyingIndex).toBeGreaterThanOrEqual(0);
      controller.abort();
      expect(kill).toHaveBeenCalledTimes(1);
      await expect(callCodingAgent('schema', 'busy')).rejects.toThrow('LLM_CODEX_BUSY');
      let settled = false;
      void pending.catch(() => (settled = true));
      await new Promise(resolve => setImmediate(resolve));
      expect(settled).toBe(false);
      children[abortedIndex].emit('close', null, 'SIGKILL');
      const occupyingArgs = args[occupyingIndex];
      await writeFile(
        occupyingArgs[occupyingArgs.indexOf('--output-last-message') + 1],
        'SELECT 3',
      );
      children[occupyingIndex].emit('close', 0, null);
      await expect(pending).rejects.toThrow('LLM_REQUEST_ABORTED');
      await expect(occupyingSlot).resolves.toBe('SELECT 3');
      behavior = async (child, path) => {
        await writeFile(path, 'SELECT 2');
        child.emit('close', 0, null);
      };
      expect(await callCodingAgent('schema', 'after-close')).toBe('SELECT 2');
    } finally {
      kill.mockRestore();
    }
  });

  it('terminates the launcher process group before releasing its concurrency slot', async () => {
    process.env.AI_TIMEOUT_MS = '10';
    behavior = async child => {
      child.pid = 123456;
    };
    const kill = jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      expect(pid).toBe(-123456);
      expect(signal).toBe('SIGKILL');
      setImmediate(() => children[0].emit('close', null, 'SIGKILL'));
      return true;
    });
    try {
      await expect(callCodingAgent('schema', 'question')).rejects.toThrow('LLM_CODEX_TIMEOUT');
      expect(kill).toHaveBeenCalledTimes(1);
      expect(children[0].kill).not.toHaveBeenCalled();
    } finally {
      kill.mockRestore();
    }
  });

  it('caps configured timeout at 180 seconds', async () => {
    process.env.AI_TIMEOUT_MS = '999999';
    const timer = jest.spyOn(global, 'setTimeout');
    try {
      await callCodingAgent('schema', 'question');
      expect(timer).toHaveBeenCalledWith(expect.any(Function), 180000);
    } finally {
      timer.mockRestore();
    }
  });

  it('rejects excess concurrency without spawning and releases slots after close', async () => {
    behavior = async () => undefined;
    const first = callCodingAgent('schema', 'one');
    const second = callCodingAgent('schema', 'two');
    await expect(callCodingAgent('schema', 'three')).rejects.toThrow('LLM_CODEX_BUSY');
    while (children.length < 2) await new Promise(resolve => setImmediate(resolve));
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(options[0].cwd).not.toBe(options[1].cwd);
    for (let i = 0; i < 2; i++) {
      await writeFile(args[i][args[i].indexOf('--output-last-message') + 1], 'SELECT 1');
      children[i].emit('close', 0, null);
    }
    await Promise.all([first, second]);
    behavior = async (child, path) => {
      await writeFile(path, 'SELECT 2');
      child.emit('close', 0, null);
    };
    expect(await callCodingAgent('schema', 'four')).toBe('SELECT 2');
  });

  it('rejects oversized prompts before spawning', async () => {
    await expect(callCodingAgent('schema', 'x'.repeat(65536))).rejects.toThrow(
      'LLM_PROMPT_TOO_LARGE',
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
