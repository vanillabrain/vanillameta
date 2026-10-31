// TS7's native CLI is the application type checker. These older development tools
// still consume the classic synchronous JS compiler API. Route only their imports.
const Module = require('node:module');
const legacyCompiler = require.resolve('typescript-api');
const legacyParents =
  /\/node_modules\/(?:@nestjs\/cli|ts-jest|ts-node|@typescript-eslint\/[^/]+|tsutils|ts-loader|serverless-plugin-typescript)\//;

const legacyTarget = specifier =>
  specifier === 'typescript'
    ? legacyCompiler
    : 'typescript-api' + specifier.slice('typescript'.length);

// @nestjs/cli resolves the TypeScript package with require.resolve() and then requires
// that absolute filename. Module load hooks do not cover the intermediate resolver, so
// route that CommonJS lookup as well; otherwise the CLI receives TypeScript 7's native
// package, which intentionally omits the classic compiler API it expects.
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (
    (request === 'typescript' || request.startsWith('typescript/')) &&
    legacyParents.test(parent?.filename || '')
  ) {
    return originalResolveFilename.call(this, legacyTarget(request), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

module.exports = Module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier === 'typescript' || specifier.startsWith('typescript/')) &&
      legacyParents.test(context.parentURL || '')
    ) {
      return nextResolve(legacyTarget(specifier), context);
    }
    return nextResolve(specifier, context);
  },
});
