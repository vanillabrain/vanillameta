import * as fs from 'fs';
import * as path from 'path';

// Nest reads a constructor parameter as required whatever `?` says in TypeScript, and only the running
// app notices a module that provides a service without what it injects (build and unit tests do not).
// The upload limits broke boot this way: AiModule provides DatabaseService itself and had no
// UserStorageService. A module that lists one of these services must list what it needs too.
const NEEDS: Record<string, string[]> = {
  DatabaseService: ['UserStorageService'],
  SourceModelService: ['UserStorageService'],
};

const modules = (directory: string): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap(entry =>
      entry.isDirectory()
        ? modules(path.join(directory, entry.name))
        : entry.name.endsWith('.module.ts')
        ? [path.join(directory, entry.name)]
        : [],
    );

/** Names in a `providers: [...]` array, written on one line or over several. */
export const providerNames = (text: string): string[] => {
  // Whichever form starts first in the file: a one-line array, or one whose `]` is on a later line.
  const forms = [/providers:\s*\[([^\]\n]*)\]/, /providers:\s*\[([\s\S]*?)\n\s*\]/]
    .map(pattern => pattern.exec(text))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => a.index - b.index);
  const block = forms[0]?.[1];
  return block ? block.match(/\b[A-Z][A-Za-z0-9]+\b/g) ?? [] : [];
};
const providers = (file: string): string[] => providerNames(fs.readFileSync(file, 'utf8'));

describe('module wiring', () => {
  it('reads providers written on one line or over several, and nothing else', () => {
    expect(providerNames('@Module({ providers: [A, B, DatabaseService], exports: [C] })')).toEqual([
      'A',
      'B',
      'DatabaseService',
    ]);
    expect(
      providerNames(
        '@Module({\n  imports: [X],\n  providers: [\n    A,\n    DatabaseService,\n  ],\n  exports: [Y],\n})',
      ),
    ).toEqual(['A', 'DatabaseService']);
    expect(providerNames('@Module({ imports: [DatabaseModule] })')).toEqual([]);
  });

  const all = modules(__dirname).map(file => ({ file, listed: new Set(providers(file)) }));

  it('reads a provider list whose names start on the first line', () => {
    expect(providerNames('@Module({ providers: [A,\n  DatabaseService,\n  ] })')).toEqual([
      'A',
      'DatabaseService',
    ]);
  });

  it('can read every module that declares providers', () => {
    const unread = modules(__dirname).filter(
      file =>
        /providers:\s*\[/.test(fs.readFileSync(file, 'utf8')) &&
        !providerNames(fs.readFileSync(file, 'utf8')).length,
    );
    expect(unread.map(file => path.basename(file))).toEqual([]);
  });

  it('finds the modules that provide the services this guards', () => {
    const names = all.filter(m => m.listed.has('DatabaseService')).map(m => path.basename(m.file));
    expect(names).toEqual(expect.arrayContaining(['ai.module.ts', 'database.module.ts']));
    expect(all.some(m => m.listed.has('SourceModelService'))).toBe(true);
  });

  it.each(Object.entries(NEEDS))(
    'every module providing %s also provides %s',
    (service, needed) => {
      const missing = all
        .filter(m => m.listed.has(service))
        .flatMap(m =>
          needed
            .filter(dep => !m.listed.has(dep))
            .map(dep => `${path.basename(m.file)} lacks ${dep}`),
        );
      expect(missing).toEqual([]);
    },
  );
});
