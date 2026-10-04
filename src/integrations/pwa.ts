import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  buildIllustrationList,
  buildPrecacheManifest,
  isPrecacheable,
  serviceWorkerFile,
  serviceWorkerSource,
} from '../lib/pwa';

/** Warn before an offline copy of the site becomes a heavy download for a phone. */
const precacheWarningBytes = 30 * 1024 * 1024;

/** Writes a service worker that precaches the static build and caches illustrations on first view. */
export default function pwa(): AstroIntegration {
  let base = '/';
  let root: URL | undefined;

  return {
    name: 'explained-pwa',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base;
        root = config.root;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!root) throw new Error('The PWA integration did not receive the Astro config.');
        const outDir = fileURLToPath(dir);
        const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
        const outputs = entries
          .filter((entry) => entry.isFile())
          .map((entry) => join(entry.parentPath, entry.name))
          .map((file) => ({ file, path: relative(outDir, file).split(sep).join('/') }));
        const files = await Promise.all(
          outputs
            .filter(({ path }) => isPrecacheable(path))
            .map(async ({ file, path }) => ({ path, content: await readFile(file) })),
        );

        const precache = buildPrecacheManifest(base, files);
        const illustrations = buildIllustrationList(base, outputs.map(({ path }) => path));
        const template = await readFile(new URL('src/pwa/service-worker.js', root), 'utf8');
        await writeFile(join(outDir, serviceWorkerFile), serviceWorkerSource(template, base, precache, illustrations));

        const bytes = files.reduce((total, { content }) => total + content.byteLength, 0);
        const size = `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        logger.info(
          `${serviceWorkerFile} precaches ${precache.length} files, ${size} in total; ${illustrations.length} illustrations are cached on first view.`,
        );
        if (bytes > precacheWarningBytes) logger.warn(`The offline copy of the site is ${size}; consider lighter illustrations.`);
      },
    },
  };
}
