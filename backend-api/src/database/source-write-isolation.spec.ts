import { DataSource, EntityManager } from 'typeorm';
import { sourceWriteTransaction } from './source-write-lock';
import * as ts from 'typescript';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Source write current-read isolation selection', () => {
  it.each(['mysql', 'mariadb', 'sqlite', 'postgres'] as const)(
    '%s selects explicit isolation only for MySQL/MariaDB, with DataSource and manager targets',
    async type => {
      for (const managerTarget of [false, true]) {
        const manager = { marker: 'transaction-manager' } as any;
        const transaction = jest.fn(async (...args: any[]) => args[args.length - 1](manager));
        const db = { options: { type }, transaction } as unknown as DataSource;
        const target = managerTarget
          ? ({ connection: db, transaction } as unknown as EntityManager)
          : db;
        const callback = jest.fn(async value => value.marker);
        expect(await sourceWriteTransaction(target, callback)).toBe('transaction-manager');
        expect(callback).toHaveBeenCalledWith(manager);
        expect(transaction.mock.calls).toEqual([
          ['mysql', 'mariadb'].includes(type) ? ['READ COMMITTED', callback] : [callback],
        ]);
      }
    },
  );

  it('wires source-basis capture before parent waits to current-read transactions', () => {
    const calls = (file: string, method: string) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(resolve(__dirname, file), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const names: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isMethodDeclaration(node) && node.name?.getText(source) === method) {
          const inspect = (child: ts.Node) => {
            if (ts.isCallExpression(child) && ts.isIdentifier(child.expression))
              names.push(child.expression.text);
            ts.forEachChild(child, inspect);
          };
          inspect(node);
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return names;
    };
    expect(calls('../bi/publication.service.ts', 'publish')).toContain('sourceWriteTransaction');
    expect(calls('../bi/publication.service.ts', 'revoke')).toContain('metadataTransaction');
    expect(calls('../bi/source-catalog.service.ts', 'save')).toContain('sourceWriteTransaction');
    expect(calls('../bi/source-catalog.service.ts', 'save')).not.toContain('metadataTransaction');
    for (const method of ['create', 'update'])
      expect(calls('../widget/widget.service.ts', method)).toContain('sourceWriteTransaction');
    for (const [file, method] of [
      ['../bi/source-conditions.service.ts', 'save'],
      ['../dashboard-studio/studio.service.ts', 'publicationSnapshot'],
      ['../dashboard-studio/studio-execution.service.ts', 'create'],
    ]) {
      expect(calls(file, method)).toContain('metadataTransaction');
      expect(calls(file, method)).not.toContain('sourceWriteTransaction');
    }
  });
});
