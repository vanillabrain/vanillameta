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
  return block ? block.match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? [] : [];
};
const providers = (file: string): string[] => providerNames(fs.readFileSync(file, 'utf8'));

/**
 * Names inside every `key: [ ... ]` in a module file, brackets balanced (so `forFeature([A, B])` does not
 * end one). Every occurrence counts: a dynamic module can hold a nested `imports:` before its real one.
 */
export const arrayNames = (text: string, key: string): string[] => {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const names: string[] = [];
  const opening = new RegExp(`\\b${key}:\\s*\\[`, 'g');
  for (let start = opening.exec(code); start; start = opening.exec(code)) {
    let depth = 1;
    let end = start.index + start[0].length;
    for (; end < code.length && depth > 0; end += 1) {
      if (code[end] === '[') depth += 1;
      else if (code[end] === ']') depth -= 1;
    }
    names.push(
      ...(code.slice(start.index + start[0].length, end - 1).match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? []),
    );
  }
  return names;
};

/** The module lists JwtService as a provider, or a module that provides it among its imports. */
export const providesJwt = (text: string): boolean =>
  [...arrayNames(text, 'imports'), ...arrayNames(text, 'providers')].some(name =>
    ['JwtService', 'JwtModule', 'AuthModule'].includes(name),
  );

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
      const providing = all.filter(m => m.listed.has(service));
      // An empty reader would make this pass for the wrong reason.
      expect(providing.length).toBeGreaterThan(0);
      const missing = providing.flatMap(m =>
        needed
          .filter(dep => !m.listed.has(dep))
          .map(dep => `${path.basename(m.file)} lacks ${dep}`),
      );
      expect(missing).toEqual([]);
    },
  );

  // JwtAuthGuard injects JwtService, and so do the guards that extend it. A module that mounts a controller
  // behind one of them without JwtService (or a module that exports it) answers every request 401
  // 'accessTokenExpired', which the client takes for an expired session and answers with a token refresh.
  // The usage endpoint shipped like that.
  describe('guards that need JwtService', () => {
    // Modules AppModule never reaches (dead code today), by path under src: not served, so not checked. A
    // basename would also exclude common/optimization/cache.module.ts, which IS mounted.
    const NOT_MOUNTED = [
      'job-queue/job-queue.module.ts',
      'cache/cache.module.ts',
      'query-timeout/query-timeout.module.ts',
      'batch-processing/batch-processing.module.ts',
    ];
    const JWT_GUARDS = /\b(JwtAuthGuard|LegacyOperationsGuard|StudioPublicationGuard)\b/;

    const rel = (file: string) => path.relative(__dirname, file).split(path.sep).join('/');

    const controllerFiles = (file: string): { found: string[]; unresolved: string[] } => {
      const text = fs.readFileSync(file, 'utf8');
      const listed = arrayNames(text, 'controllers');
      const found: string[] = [];
      const unresolved: string[] = [];
      for (const name of listed) {
        const from = new RegExp(
          `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'(\\.[^']+)'`,
        ).exec(text)?.[1];
        const resolved = from ? path.resolve(path.dirname(file), from) + '.ts' : '';
        if (resolved && fs.existsSync(resolved)) found.push(resolved);
        else unresolved.push(`${rel(file)}: ${name}`);
      }
      return { found, unresolved };
    };
    const scanned = modules(__dirname)
      .filter(file => !NOT_MOUNTED.includes(rel(file)))
      .map(file => ({ file, ...controllerFiles(file) }));
    const guarded = scanned
      .filter(m => m.found.some(c => JWT_GUARDS.test(fs.readFileSync(c, 'utf8'))))
      .map(m => m.file);

    it('resolves every controller it is asked about, so the rule cannot lose coverage quietly', () => {
      expect(scanned.flatMap(m => m.unresolved)).toEqual([]);
    });

    it('finds the modules that serve guarded controllers, including those behind a subclass of the guard', () => {
      const names = guarded.map(rel);
      expect(names).toEqual(
        expect.arrayContaining(['usage/usage.module.ts', 'ai/ai.module.ts', 'bi/bi.module.ts']),
      );
      expect(names.length).toBeGreaterThan(15);
    });

    it('does not exclude a mounted module that merely shares a file name with an unmounted one', () => {
      expect(NOT_MOUNTED).not.toContain('cache.module.ts');
      expect(modules(__dirname).map(rel)).toContain('common/optimization/cache.module.ts');
      expect(guarded.map(rel)).toContain('common/optimization/cache.module.ts');
    });

    it('every such module provides JwtService or imports a module that does', () => {
      const lacking = guarded.filter(file => !providesJwt(fs.readFileSync(file, 'utf8')));
      expect(lacking.map(rel)).toEqual([]);
    });

    it('notices the shapes the usage module had: a comment naming JwtService, or a bare import line', () => {
      const comment =
        '@Module({\n  // JwtAuthGuard injects JwtService\n  imports: [TypeOrmModule.forFeature([A])],\n})';
      const bareImport =
        "import { JwtModule } from '@nestjs/jwt';\n@Module({ imports: [TypeOrmModule.forFeature([A, B])], providers: [S] })";
      const ok =
        '@Module({ imports: [TypeOrmModule.forFeature([A, B]), JwtModule], providers: [S] })';
      const viaProvider = '@Module({ providers: [A, JwtService] })';
      expect(providesJwt(comment)).toBe(false);
      expect(providesJwt(bareImport)).toBe(false);
      expect(providesJwt(ok)).toBe(true);
      expect(providesJwt(viaProvider)).toBe(true);
      // A dynamic module: a nested `imports:` (for the queue's config) comes before the module's own.
      const dynamic =
        '@Module({}) class R {}\nfn() { const q = [Bull.registerQueueAsync({ imports: [ConfigModule] })]; return { imports: [AuthModule, ...q] }; }';
      expect(providesJwt(dynamic)).toBe(true);
      const dynamicWithout =
        'fn() { const q = [Bull.registerQueueAsync({ imports: [ConfigModule] })]; return { imports: [...q] }; }';
      expect(providesJwt(dynamicWithout)).toBe(false);
    });
  });
});
