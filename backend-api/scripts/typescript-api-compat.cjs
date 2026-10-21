// TS7's native CLI is the application type checker. These older development tools
// still consume the classic synchronous JS compiler API. Route only their imports.
const { registerHooks } = require('node:module');
const legacyCompiler = require.resolve('typescript-api');
const legacyParents =
  /\/node_modules\/(?:@nestjs\/cli|ts-jest|ts-node|@typescript-eslint\/[^/]+|tsutils|ts-loader|serverless-plugin-typescript)\//;

module.exports = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier === 'typescript' || specifier.startsWith('typescript/')) &&
      legacyParents.test(context.parentURL || '')
    ) {
      const target =
        specifier === 'typescript'
          ? legacyCompiler
          : 'typescript-api' + specifier.slice('typescript'.length);
      return nextResolve(target, context);
    }
    return nextResolve(specifier, context);
  },
});
