const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
require('./typescript-api-compat.cjs');

test('application imports keep the native TypeScript7 package', () => {
  const application = createRequire(path.join(__dirname, '../src/main.js'));
  assert.match(application('typescript').version, /^7\./);
  assert.equal(application('typescript').transpileModule, undefined);
});

test('Nest CLI binary loader receives the classic compiler API', () => {
  const { TypeScriptBinaryLoader } = require('@nestjs/cli/lib/compiler/typescript-loader');
  const api = new TypeScriptBinaryLoader().load();
  assert.equal(api.version, '5.9.3');
  assert.equal(typeof api.getParsedCommandLineOfConfigFile, 'function');
});

for (const tool of [
  '@nestjs/cli',
  'ts-jest',
  'ts-node',
  '@typescript-eslint/typescript-estree',
  'tsutils',
]) {
  test(`${tool} receives the explicit classic compiler API only`, () => {
    const importer = createRequire(require.resolve(`${tool}/package.json`));
    const api = importer('typescript');
    assert.equal(api.version, '5.9.3');
    assert.equal(typeof api.transpileModule, 'function');
    assert.equal(typeof api.createProgram, 'function');
    assert.match(require('typescript').version, /^7\./);
  });
}
