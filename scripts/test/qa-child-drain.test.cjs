const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  observerSource,
  createBackendObserver,
} = require("../lib/qa-child-drain.cjs");
const alive = (c) => c.exitCode === null && c.signalCode === null;
async function fixture(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vm-drain-test-"));
  const nonce = randomUUID();
  // Fault injection affects only the owned child's group inspection, never the parent.
  fs.writeFileSync(
    path.join(dir, "fault.cjs"),
    `
 const original=process.kill;let checks=0;global.allowChecks=false;
 process.kill=function(pid,sig){if(pid<0&&sig===0&&!global.allowChecks&&('${mode}'==='persistent'||++checks===1)){const e=new Error('injected');e.code='EPERM';throw e;}return original.apply(this,arguments)};
 const send=process.send;
 process.send=function(value,...args){if('${mode}'==='ipc'&&value.kind==='absent'){throw new Error('injected proof send failure')}if('${mode}'==='async-ipc'&&value.kind==='absent'){setImmediate(()=>args.at(-1)(new Error('injected async proof failure')));return false}return send.call(this,value,...args)};
 `
  );
  fs.writeFileSync(path.join(dir, "observer.cjs"), observerSource(nonce));
  const child = spawn(
    process.execPath,
    [
      "--require",
      path.join(dir, "fault.cjs"),
      "--require",
      path.join(dir, "observer.cjs"),
      "-e",
      `
 const cp=require('node:child_process');const p=cp.spawn(process.execPath,['-e','setTimeout(()=>{},180)'],{detached:true,stdio:'ignore'});
 process.send({fixturePid:p.pid});process.on('message',m=>{if(m.op==='allow')global.allowChecks=true});setInterval(()=>{},1000);
 `,
    ],
    { stdio: ["ignore", "ignore", "ignore", "ipc"] }
  );
  const observer = createBackendObserver({ alive, requestId: randomUUID });
  observer.observe(child, nonce);
  const messages = [];
  child.on("message", (m) => messages.push(m));
  const until = async (f) => {
    for (let i = 0; i < 300; i++) {
      if (f()) return;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw Error("Fixture timeout");
  };
  await until(
    () => observer.states.get(child).ready && messages.some((m) => m.fixturePid)
  );
  return {
    child,
    observer,
    messages,
    until,
    async close() {
      const exited = new Promise((r) => child.once("exit", r));
      child.kill("SIGKILL");
      await exited;
      const pid = messages.find((m) => m.fixturePid).fixturePid;
      try {
        process.kill(-pid, "SIGKILL");
      } catch (e) {
        if (e.code !== "ESRCH") throw e;
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("transient group query error retains group until absence then permits fresh drain", async () => {
  const f = await fixture("once");
  try {
    await f.until(() =>
      f.messages.some(
        (m) => m.kind === "check-error" || m.kind === "unverifiable"
      )
    );
    await assert.rejects(f.observer.drain(f.child, 20));
    assert.equal(f.observer.states.get(f.child).drained, false);
    await f.observer.drain(f.child, 2000);
    assert.equal(f.observer.states.get(f.child).groups.size, 0);
    assert.equal(f.observer.states.get(f.child).drained, true);
  } finally {
    await f.close();
  }
});
test("persistent query failure refuses cleanup and keeps ownership state", async () => {
  const f = await fixture("persistent");
  try {
    await f.until(() =>
      f.messages.some(
        (m) => m.kind === "check-error" || m.kind === "unverifiable"
      )
    );
    await assert.rejects(f.observer.drain(f.child, 300));
    assert.equal(alive(f.child), true);
    assert.equal(f.observer.states.get(f.child).drained, false);
    assert.equal(f.observer.states.get(f.child).groups.size, 1);
    f.child.send({ op: "allow" });
    await f.observer.drain(f.child, 2000);
  } finally {
    await f.close();
  }
});
test("proof IPC failure remains fatal even after group disappearance", async () => {
  const f = await fixture("ipc");
  try {
    await f.until(() => f.observer.states.get(f.child).failed);
    await assert.rejects(f.observer.drain(f.child, 300));
    assert.equal(f.observer.states.get(f.child).drained, false);
  } finally {
    await f.close();
  }
});
test("asynchronous proof delivery failure cannot authorize cleanup", async () => {
  const f = await fixture("async-ipc");
  try {
    await f.until(() => f.observer.states.get(f.child).failed);
    await assert.rejects(f.observer.drain(f.child, 300));
    assert.equal(f.observer.states.get(f.child).drained, false);
  } finally {
    await f.close();
  }
});
test("disconnect during drain rejects and preserves proof state", async () => {
  const observer = createBackendObserver({ alive, requestId: randomUUID });
  const c = new EventEmitter();
  Object.assign(c, {
    exitCode: null,
    signalCode: null,
    send() {
      c.emit("disconnect");
    },
  });
  observer.observe(c, "n");
  c.emit("message", { qaObserver: "n", kind: "ready" });
  await assert.rejects(observer.drain(c, 200), /disconnected/);
  assert.equal(observer.states.get(c).drained, false);
  assert.equal(observer.states.get(c).failed, true);
});
test("wrong request cannot certify drain; dead IPC cannot authorize cleanup", async () => {
  const observer = createBackendObserver({ alive, requestId: () => "fresh" });
  const c = new EventEmitter();
  Object.assign(c, {
    exitCode: null,
    signalCode: null,
    send(m, cb) {
      c.emit("message", { qaObserver: "n", kind: "drained", request: "old" });
      cb?.();
    },
  });
  observer.observe(c, "n");
  c.emit("message", { qaObserver: "n", kind: "ready" });
  await assert.rejects(observer.drain(c, 20));
  assert.equal(observer.states.get(c).drained, false);
  c.send = (m, cb) => cb(Error("IPC closed"));
  await assert.rejects(observer.drain(c, 20), /IPC/);
});

test("late callback from timed-out drain cannot reject a fresh request", async () => {
  const observer = createBackendObserver({ alive, requestId: randomUUID });
  const c = new EventEmitter(),
    sent = [];
  Object.assign(c, {
    exitCode: null,
    signalCode: null,
    send(message, callback) {
      sent.push({ message, callback });
    },
  });
  observer.observe(c, "n");
  c.emit("message", { qaObserver: "n", kind: "ready" });
  await assert.rejects(observer.drain(c, 15));
  const retry = observer.drain(c, 200);
  sent[0].callback(Error("stale error"));
  c.emit("message", {
    qaObserver: "n",
    kind: "drained",
    request: sent[1].message.request,
  });
  await retry;
  assert.equal(observer.states.get(c).drained, true);
});

test("synchronous parent send failure retires its pending request", async () => {
  const observer = createBackendObserver({ alive, requestId: randomUUID });
  const c = new EventEmitter();
  Object.assign(c, {
    exitCode: null,
    signalCode: null,
    send() {
      throw Error("closed");
    },
  });
  observer.observe(c, "n");
  c.emit("message", { qaObserver: "n", kind: "ready" });
  await assert.rejects(observer.drain(c, 500), /IPC unavailable/);
  assert.equal(observer.states.get(c).pending, undefined);
  assert.equal(observer.states.get(c).drained, false);
});
