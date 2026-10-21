// Jest 28 executes tests as CommonJS. Transform only the ESM-only TypeORM adapter;
// application TypeScript keeps its existing ts-jest type checking.
const ts = require('typescript');
const { createHash } = require('crypto');
const { readFileSync } = require('fs');
module.exports = {
  getCacheKey(sourceText, sourcePath, options) {
    return createHash('sha256')
      .update(readFileSync(__filename))
      .update(ts.version)
      .update(sourcePath)
      .update(sourceText)
      .update(String(options.instrument))
      .update(options.configString)
      .digest('hex');
  },
  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        sourceMap: true,
      },
      transformers: {
        before: [
          context => source => {
            // This ESM helper declares its own require via createRequire(import.meta.url).
            // CommonJS already supplies the same file-relative loader. Keep Jest's loader
            // so TypeORM constructor identity and mocks use the same module instance.
            if (!sourcePath.endsWith('/common/typeorm-compat.js')) return source;
            return ts.visitEachChild(
              source,
              node => {
                if (
                  ts.isVariableStatement(node) &&
                  node.declarationList.declarations.length === 1
                ) {
                  const declaration = node.declarationList.declarations[0];
                  if (
                    ts.isIdentifier(declaration.name) &&
                    declaration.name.text === 'require' &&
                    declaration.initializer &&
                    ts.isCallExpression(declaration.initializer) &&
                    ts.isIdentifier(declaration.initializer.expression) &&
                    declaration.initializer.expression.text === 'createRequire'
                  )
                    return undefined;
                }
                return node;
              },
              context,
            );
          },
        ],
      },
    });
    return { code: result.outputText, map: result.sourceMapText };
  },
};
