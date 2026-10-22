// Ownership proof for QA children only; never discovers or kills arbitrary PIDs.
function observerSource(nonce) {
  return `
const cp = require('node:child_process');
const original = cp.spawn;
const nonce = ${JSON.stringify(nonce)};
const groups = new Set(), checkErrors = new Map();
let draining = false, request, proofFailed = false, pendingProofs = 0;
function failProof() {
  if (proofFailed) return;
  proofFailed = true;
  if (process.connected) try { process.send({qaObserver:nonce,kind:'unverifiable'},()=>{}); } catch {}
}
function send(value) {
  if (proofFailed || !process.connected) { failProof(); return false; }
  pendingProofs++;
  try {
    process.send({qaObserver:nonce,...value}, error => {
      pendingProofs--;
      if (error) failProof();
    });
    return true;
  } catch { pendingProofs--; failProof(); return false; }
}
function exists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (e) { if (e.code === 'ESRCH') return false; throw e; }
}
function inspect() {
  if (proofFailed) return;
  for (const pid of groups) {
    let present;
    try { present = exists(pid); }
    catch (e) {
      const code = ['EPERM','EACCES','EINVAL'].includes(e.code) ? e.code : 'UNKNOWN';
      if (checkErrors.get(pid) !== code) send({kind:'check-error',pid,code});
      checkErrors.set(pid,code);
      continue; // Unknown is not absent: retain this owned group and retry inspection.
    }
    if (checkErrors.delete(pid)) send({kind:'check-ok',pid});
    if (!present && send({kind:'absent',pid})) groups.delete(pid);
  }
  // Fence includes proof delivery callbacks as well as the complete owned census.
  if (draining && request && groups.size === 0 && pendingProofs === 0 && !proofFailed) {
    if (send({kind:'drained',request})) request = undefined;
  }
}
cp.spawn = function(command, args, options) {
  if (draining || proofFailed) throw new Error('QA_CHILD_ADMISSION_DRAINING');
  const child = original.apply(this, arguments);
  const settings = Array.isArray(args) ? options : args;
  if (settings?.detached && Number.isSafeInteger(child.pid)) {
    groups.add(child.pid); send({kind:'spawn',pid:child.pid});
  }
  return child;
};
require('node:module').syncBuiltinESMExports();
process.on('message', message => {
  if (message?.qaObserver !== nonce || message.op !== 'drain') return;
  draining = true; request = message.request; inspect();
});
process.on('disconnect', () => { draining = true; });
setInterval(inspect, 25).unref();
send({kind:'ready'});
`;
}

function createBackendObserver({ alive, requestId }) {
  const observedBackends = new WeakMap();
  function observeBackend(child, nonce) {
    const state = {
      ready: false,
      groups: new Set(),
      drained: false,
      failed: false,
      checkErrors: new Map(),
      pending: undefined,
    };
    observedBackends.set(child, state);
    child.on("message", (message) => {
      if (message?.qaObserver !== nonce) return;
      if (message.kind === "ready") state.ready = true;
      else if (
        message.kind === "spawn" &&
        Number.isSafeInteger(message.pid) &&
        message.pid > 1
      )
        state.groups.add(message.pid);
      else if (message.kind === "absent") {
        state.groups.delete(message.pid);
        state.checkErrors.delete(message.pid);
      } else if (
        message.kind === "check-error" &&
        state.groups.has(message.pid)
      )
        state.checkErrors.set(message.pid, message.code);
      else if (message.kind === "check-ok")
        state.checkErrors.delete(message.pid);
      else if (message.kind === "unverifiable") state.failed = true;
      else if (
        message.kind === "drained" &&
        state.pending?.request === message.request
      ) {
        if (state.failed || state.groups.size)
          state.pending.reject(
            new Error("Owned child groups not proven absent")
          );
        else {
          state.drained = true;
          state.pending.resolve();
        }
      }
    });
    child.on("disconnect", () => {
      if (!state.drained) {
        state.failed = true;
        state.pending?.reject(
          new Error("Owned child IPC disconnected; resources retained")
        );
      }
    });
    child.on("exit", () => {
      if (!state.drained)
        state.pending?.reject(
          new Error("API exited before owned-child drain confirmation")
        );
    });
    state.nonce = nonce;
  }
  async function drainBackend(child, timeout = 180000) {
    const state = observedBackends.get(child);
    if (!state || state.drained) return;
    if (!alive(child) || !state.ready || state.failed)
      throw new Error("Cannot prove API child ownership; resources retained");
    if (state.pending) throw new Error("Owned child drain already pending");
    try {
      await new Promise((resolve, reject) => {
        const request = requestId();
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                "Owned child drain exceeded bounded wait; resources retained"
              )
            ),
          timeout
        );
        state.pending = {
          request,
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };
        const attempt = state.pending;
        const rejectSend = () => {
          if (state.pending === attempt)
            attempt.reject(
              new Error("Owned child IPC unavailable; resources retained")
            );
        };
        try {
          child.send(
            { qaObserver: state.nonce, op: "drain", request },
            (error) => {
              if (error) rejectSend();
            }
          );
        } catch {
          rejectSend();
        }
      });
    } finally {
      state.pending = undefined;
    }
  }

  return {
    states: observedBackends,
    observe: observeBackend,
    drain: drainBackend,
  };
}
module.exports = { observerSource, createBackendObserver };
