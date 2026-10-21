#!/usr/bin/env node
// Interactive setup only. Password and token never enter argv or stdout.
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, formatConfig } from "../src/api.js";
const { values } = parseArgs({
  options: {
    "api-url": { type: "string" },
    "web-url": { type: "string" },
    output: {
      type: "string",
      default: fileURLToPath(new URL("../.env.local", import.meta.url)),
    },
  },
});
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output,
  terminal: !!process.stdin.isTTY,
});
try {
  if (!process.stdin.isTTY)
    throw Error("Run this setup in an interactive terminal.");
  const config = loadConfig({
    VM_API_URL: values["api-url"],
    VM_WEB_URL: values["web-url"],
    VM_ACCESS_TOKEN: "setup",
  });
  const userId = (await rl.question("VanillaMeta login ID: ")).trim();
  process.stdout.write("Password (hidden): ");
  muted = true;
  const password = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  const response = await fetch(config.apiUrl + "/login/signin", {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error("Login failed. Check the account and API address.");
  const { accessToken } = await response.json();
  loadConfig({
    VM_API_URL: config.apiUrl,
    VM_WEB_URL: config.webUrl,
    VM_ACCESS_TOKEN: accessToken,
  });
  const file = resolve(values.output);
  await writeFile(file, formatConfig({ ...config, token: accessToken }), {
    mode: 0o600,
    flag: "wx",
  });
  process.stdout.write(
    `Saved private configuration: ${file}\nExisting files are never overwritten. Use this file with node --env-file.\n`
  );
} catch (error) {
  muted = false;
  process.stderr.write(
    error.code === "EEXIST"
      ? "Configuration already exists. Choose a new --output file; update your MCP config to use it.\n"
      : "Setup failed. Check arguments, credentials, file permissions and the API connection.\n"
  );
  process.exitCode = 1;
} finally {
  rl.close();
}
