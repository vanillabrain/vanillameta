import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
const entry = fileURLToPath(new URL("../src/index.js", import.meta.url));
test("real stdio child initializes and discovers tools with protocol-only stdout", async (t) => {
  const client = new Client({ name: "stdio-test", version: "1" }),
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [entry],
      env: {
        VM_API_URL: "http://127.0.0.1:1/v1",
        VM_WEB_URL: "http://127.0.0.1:3000",
        VM_ACCESS_TOKEN: "private.jwt.token",
      },
      stderr: "pipe",
    });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 6);
});
test("invalid setup exits without printing credentials or non-protocol stdout", () => {
  const r = spawnSync(process.execPath, [entry], {
    env: {
      VM_API_URL: "https://user:SECRET@example.com",
      VM_WEB_URL: "http://127.0.0.1",
      VM_ACCESS_TOKEN: "private.jwt.token",
    },
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert(!r.stderr.includes("SECRET"));
  assert(!r.stderr.includes("private.jwt.token"));
});
