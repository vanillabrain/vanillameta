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

const providers = (file: string): string[] => {
  const block = /providers:\s*\[([\s\S]*?)\n\s*\]/.exec(fs.readFileSync(file, 'utf8'));
  return block ? block[1].match(/\b[A-Z][A-Za-z0-9]+\b/g) ?? [] : [];
};

describe('module wiring', () => {
  const all = modules(__dirname).map(file => ({ file, listed: new Set(providers(file)) }));

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
