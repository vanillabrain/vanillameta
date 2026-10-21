import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, formatConfig, VmApi, VmError } from "../src/api.js";
const env = {
  VM_API_URL: "http://127.0.0.1:4250/v1",
  VM_WEB_URL: "http://127.0.0.1:3250",
  VM_ACCESS_TOKEN: "private.jwt.token",
};
test("rejects unsafe endpoints, credentials and missing identity before any request", () => {
  for (const value of [
    "http://example.com/v1",
    "https://user:secret@example.com/v1",
    "https://example.com/v1?x=1",
    "file:///etc/passwd",
  ])
    assert.throws(() => loadConfig({ ...env, VM_API_URL: value }), /VM_CONFIG/);
  assert.throws(() => loadConfig({ ...env, VM_ACCESS_TOKEN: "" }), /VM_CONFIG/);
  assert.throws(
    () => loadConfig({ ...env, VM_ACCESS_TOKEN: "token\r\nheader" }),
    /VM_CONFIG/
  );
});
test("uses fixed endpoint and bearer, rejects redirects without leaking server body", async () => {
  let request;
  const api = new VmApi(loadConfig(env), async (url, options) => {
    request = { url, options };
    return new Response("private.jwt.token SQL secret", {
      status: 302,
      headers: { location: "https://elsewhere.invalid" },
    });
  });
  await assert.rejects(
    api.request("GET", "/bi/sources"),
    (e) =>
      e instanceof VmError &&
      e.code === "VM_HTTP_302" &&
      !e.message.includes("secret")
  );
  assert.equal(request.options.redirect, "error");
  assert.equal(
    request.options.headers.Authorization,
    "Bearer private.jwt.token"
  );
  assert.equal(request.url, "http://127.0.0.1:4250/v1/bi/sources");
});
test("unwraps success, rejects logical failures and bounds response bodies", async () => {
  const config = loadConfig(env);
  assert.deepEqual(
    await new VmApi(config, async () =>
      Response.json({ status: "SUCCESS", data: [1] })
    ).request("GET", "/bi/sources"),
    [1]
  );
  await assert.rejects(
    new VmApi(config, async () =>
      Response.json({ status: "ERROR", message: "SQL secret" })
    ).request("GET", "/bi/sources"),
    (e) => e.code === "VM_API_ERROR" && !e.message.includes("secret")
  );
  await assert.rejects(
    new VmApi(
      config,
      async () => new Response("x".repeat(2 * 1024 * 1024 + 1))
    ).request("GET", "/bi/sources"),
    (e) => e.code === "VM_RESPONSE_TOO_LARGE"
  );
});
test("cancellation and deadlines stop HTTP without auto retries", async () => {
  let calls = 0;
  const mock = async (_u, { signal }) =>
    new Promise((_r, j) => {
      calls++;
      signal.addEventListener("abort", () => j(signal.reason), { once: true });
    });
  const controller = new AbortController();
  const p = new VmApi(loadConfig(env), mock).request(
    "POST",
    "/studio/proposals",
    {},
    controller.signal
  );
  controller.abort();
  await assert.rejects(p, (e) => e.code === "VM_CANCELLED");
  assert.equal(calls, 1);
  await assert.rejects(
    new VmApi({ ...loadConfig(env), timeoutMs: 10 }, mock).request(
      "GET",
      "/bi/sources"
    ),
    (e) => e.code === "VM_TIMEOUT"
  );
});

test("generated private config parses as three separate environment assignments", async () => {
  const { parseEnv } = await import("node:util");
  const config = loadConfig(env);
  assert.deepEqual(
    { ...parseEnv(formatConfig(config)) },
    {
      VM_API_URL: config.apiUrl,
      VM_WEB_URL: config.webUrl,
      VM_ACCESS_TOKEN: config.token,
    }
  );
});
