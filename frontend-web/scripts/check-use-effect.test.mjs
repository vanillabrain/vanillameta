import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inventory, violations } from './check-use-effect.mjs';

test('blocks new direct and aliased React effects, preserving legacy counts and reviewed files', () => {
  const root = mkdtempSync(join(tmpdir(), 'vm-effect-rule-'));
  try {
    writeFileSync(join(root, 'Screen.tsx'), `import React, { useEffect, useEffect as subscribe } from 'react';
import * as Hooks from 'react';
useEffect(() => {}, []);
useEffect(() => {}, []);
subscribe(() => {}, []);
React.useEffect(() => {}, []);
Hooks['useEffect'](() => {}, []);
function other(subscribe: () => void) { subscribe(); }
const { useEffect: effect } = React;
effect(() => {}, []);`);
    writeFileSync(join(root, 'Adapter.ts'), "import { useEffect } from 'react'; useEffect(() => {}, []);");
    writeFileSync(join(root, 'Screen.test.ts'), "import { useEffect } from 'react'; useEffect(() => {}, []);");

    writeFileSync(join(root, 'Module.mts'), "import { useEffect } from 'react'; useEffect(() => {}, []);");
    const entries = inventory(root).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    const legacy = entries.find(entry => entry.file === 'src/Screen.tsx');
    assert.equal(entries.length, 8);
    assert.equal(violations(entries, {}, new Set()).length, 8);
    const rejected = violations(entries, { [legacy.file + ':' + legacy.hash]: 1 }, new Set(['src/Adapter.ts']));
    assert.deepEqual(rejected.map(entry => entry.line), [1, 4, 5, 6, 7, 10]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
