import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Only reviewed modules that own a specific external subscription belong here.
const adapters = new Set([]);
const baselinePath = resolve(project, 'scripts/use-effect-baseline.json');

export function inventory(root) {
  const files = ts.sys.readDirectory(root, ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'])
    .filter(file => !/\.d\.(ts|mts|cts)$/.test(file) && !/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(file) && !/\/(__tests__|__mocks__)\//.test(file));
  const program = ts.createProgram(files, { allowJs: true, noResolve: true, noLib: true, types: [] });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: true });
  const entries = [];

  for (const source of program.getSourceFiles()) {
    const file = 'src/' + relative(root, source.fileName);
    const named = new Set();
    const namespaces = new Set();
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react') continue;
      const clause = statement.importClause;
      if (clause?.name) namespaces.add(checker.getSymbolAtLocation(clause.name));
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(checker.getSymbolAtLocation(bindings.name));
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) {
          const name = (binding.propertyName ?? binding.name).text;
          if (name === 'useEffect') named.add(checker.getSymbolAtLocation(binding.name));
          if (name === 'default') namespaces.add(checker.getSymbolAtLocation(binding.name));
        }
      }
    }

    function reactBinding(node, bindings) {
      while (node && ts.isParenthesizedExpression(node)) node = node.expression;
      return !!node && ts.isIdentifier(node) && bindings.has(checker.getSymbolAtLocation(node));
    }

    function collectDestructuredEffects(node) {
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)
        && reactBinding(node.initializer, namespaces)) {
        for (const binding of node.name.elements) {
          const property = binding.propertyName ?? binding.name;
          if ((ts.isIdentifier(property) || ts.isStringLiteral(property)) && property.text === 'useEffect'
            && ts.isIdentifier(binding.name)) named.add(checker.getSymbolAtLocation(binding.name));
        }
      }
      ts.forEachChild(node, collectDestructuredEffects);
    }

    function visit(node) {
      if (ts.isCallExpression(node)) {
        let callee = node.expression;
        while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
        const direct = reactBinding(callee, named);
        const member = ts.isPropertyAccessExpression(callee) && callee.name.text === 'useEffect';
        const indexed = ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression)
          && callee.argumentExpression.text === 'useEffect';
        if (direct || ((member || indexed) && reactBinding(callee.expression, namespaces))) {
          const signature = printer.printNode(ts.EmitHint.Expression, node, source);
          const hash = createHash('sha256').update(signature).digest('hex').slice(0, 24);
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          entries.push({ file, hash, line });
        }
      }
      ts.forEachChild(node, visit);
    }

    collectDestructuredEffects(source);
    visit(source);
  }
  return entries;
}

export function violations(entries, baseline, allowedAdapters) {
  const remaining = new Map(Object.entries(baseline));
  return entries.filter(({ file, hash }) => {
    if (allowedAdapters.has(file)) return false;
    const key = file + ':' + hash;
    const allowed = remaining.get(key) ?? 0;
    if (!allowed) return true;
    remaining.set(key, allowed - 1);
    return false;
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scoped = inventory(resolve(project, 'src'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const rejected = violations(scoped, baseline, adapters);
  for (const { file, line } of rejected) {
    console.error(`${file}:${line} New React useEffect. Use render derivation, an event handler, a query hook, or a reviewed external-system adapter.`);
  }
  if (rejected.length) process.exitCode = 1;
  else console.log(`Effect policy passed (${scoped.length} existing or reviewed calls).`);
}
