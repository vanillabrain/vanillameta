import { build } from 'esbuild';
import { injectManifest } from 'workbox-build';
import { resolve, join } from 'node:path';
import { rm } from 'node:fs/promises';
import type { Plugin, ResolvedConfig } from 'vite';

/** Preserve main's offline static shell on Vite; authenticated API responses stay network-only. */
export function serviceWorkerBuild(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'vanillameta-service-worker',
    apply: 'build',
    configResolved(value) {
      config = value;
    },
    async closeBundle() {
      const directory = resolve(config.root, config.build.outDir);
      const temporary = join(directory, '.service-worker-input.js');
      try {
        await build({
          entryPoints: [resolve(config.root, 'src/service-worker.ts')],
          outfile: temporary,
          bundle: true,
          format: 'iife',
          platform: 'browser',
          target: 'es2020',
          define: { 'import.meta.env.BASE_URL': JSON.stringify(config.base) },
        });
        await injectManifest({
          swSrc: temporary,
          swDest: join(directory, 'service-worker.js'),
          globDirectory: directory,
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          globIgnores: ['service-worker.js', '.service-worker-input.js'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        });
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
