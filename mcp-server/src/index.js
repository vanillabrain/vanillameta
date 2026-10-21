#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";
import { loadConfig } from "./api.js";
try {
  const config = loadConfig();
  const handle = serveStdio(() => createServer(config), {
    onerror: () => {
      process.stderr.write("VanillaMeta MCP protocol error.\n");
    },
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await handle.close();
      process.exit(0);
    });
} catch {
  process.stderr.write(
    "VanillaMeta MCP configuration invalid. Set VM_API_URL, VM_WEB_URL and VM_ACCESS_TOKEN.\n"
  );
  process.exitCode = 1;
}
