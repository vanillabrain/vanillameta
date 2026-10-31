const MAX_RESPONSE = 2 * 1024 * 1024;
export class VmError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function endpoint(value) {
  try {
    const u = new URL(value);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !["https:", "http:"].includes(u.protocol) ||
      (u.protocol === "http:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    )
      throw Error();
    return u.href.replace(/\/+$/, "");
  } catch {
    throw new VmError("VM_CONFIG_INVALID_URL");
  }
}
export function configForToken(env, token) {
  if (
    typeof token !== 'string' ||
    !token ||
    token.length > 16384 ||
    /\s/.test(token)
  )
    throw new VmError('VM_CONFIG_ACCESS_TOKEN_REQUIRED');
  return {
    apiUrl: endpoint(env.VM_API_URL),
    webUrl: endpoint(env.VM_WEB_URL),
    token,
    timeoutMs: 190000,
  };
}
export function loadConfig(env = process.env) {
  return configForToken(env, env.VM_ACCESS_TOKEN);
}
export class VmApi {
  constructor(config, fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }
  async request(method, path, body, signal) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) controller.abort();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);
    try {
      const response = await this.fetcher(this.config.apiUrl + path, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new VmError(`VM_HTTP_${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new VmError("VM_INVALID_RESPONSE");
      let size = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE) {
            await reader.cancel();
            throw new VmError("VM_RESPONSE_TOO_LARGE");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (data?.status === "ERROR") throw new VmError("VM_API_ERROR");
      return data?.status === "SUCCESS" ? data.data : data;
    } catch (error) {
      if (timedOut) throw new VmError("VM_TIMEOUT");
      if (signal?.aborted) throw new VmError("VM_CANCELLED");
      if (error instanceof VmError) throw error;
      throw new VmError("VM_CONNECTION_OR_RESPONSE_ERROR");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
}

export function formatConfig(config) {
  return [
    "# VanillaMeta MCP login configuration",
    `VM_API_URL=${config.apiUrl}`,
    `VM_WEB_URL=${config.webUrl}`,
    `VM_ACCESS_TOKEN=${config.token}`,
    "",
  ].join("\n");
}
