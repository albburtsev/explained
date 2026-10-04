import { createHash } from 'node:crypto';
import { homePath, normalizeBase } from './content';
import { locales, t, type Locale } from './i18n';

/** Page backgrounds of both themes; they must match `--color-background` in global.css. */
export const themeColors = { dark: '#1a1a17', light: '#f7f1e3' } as const;

/** The logo, shared with public/favicon.svg. */
export const logo = {
  background: '#1d6480',
  foreground: '#f7f5ed',
  glyph: 'M20 17h27v8H29v7h16v8H29v7h19v8H20z',
} as const;

export type AppIcon = {
  name: string;
  size: number;
  /** A full-bleed square with the glyph inside the safe zone, for platforms that apply their own mask. */
  maskable: boolean;
};

export const appIcons: readonly AppIcon[] = [
  { name: 'icon-192', size: 192, maskable: false },
  { name: 'icon-512', size: 512, maskable: false },
  { name: 'icon-maskable-512', size: 512, maskable: true },
  // iOS rounds the corners itself and fills transparency with black.
  { name: 'apple-touch-icon', size: 180, maskable: true },
];

function siteRoot(base: string): string {
  return `${normalizeBase(base)}/`;
}

export function appIconPath(base: string, name: string): string {
  return `${siteRoot(base)}icons/${name}.png`;
}

export function appIconSvg(maskable: boolean): string {
  const shape = maskable
    // The glyph is centred and scaled to stay inside the maskable safe zone.
    ? `<rect width="64" height="64" fill="${logo.background}"/><path transform="translate(32 32) scale(.8) translate(-34 -36)" d="${logo.glyph}" fill="${logo.foreground}"/>`
    : `<rect width="64" height="64" rx="16" fill="${logo.background}"/><path d="${logo.glyph}" fill="${logo.foreground}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${shape}</svg>`;
}

export function webManifestPath(base: string, locale: Locale): string {
  return `${homePath(base, locale)}manifest.webmanifest`;
}

/** Both locales describe the same app: they share `id` and `scope` and start on their own home page. */
export function buildWebManifest(base: string, locale: Locale) {
  const root = siteRoot(base);
  return {
    id: root,
    name: 'Explained',
    short_name: 'Explained',
    description: t(locale).siteDescription,
    lang: locale,
    dir: 'ltr',
    start_url: homePath(base, locale),
    scope: root,
    display: 'standalone',
    background_color: themeColors.dark,
    theme_color: themeColors.dark,
    icons: appIcons
      .filter((icon) => icon.name !== 'apple-touch-icon')
      .map((icon) => ({
        src: appIconPath(base, icon.name),
        sizes: `${icon.size}x${icon.size}`,
        type: 'image/png',
        purpose: icon.maskable ? 'maskable' : 'any',
      })),
  };
}

export function offlinePath(base: string, locale: Locale): string {
  return `${homePath(base, locale)}offline/`;
}

/** Locale home prefixes with their offline page, longest prefix first so the default locale matches last. */
export function offlinePages(base: string): [prefix: string, url: string][] {
  return locales
    .map((locale): [string, string] => [homePath(base, locale), offlinePath(base, locale)])
    .toSorted(([a], [b]) => b.length - a.length);
}

export const serviceWorkerFile = 'sw.js';

/**
 * A lesson illustration optimized by Astro; `file` is relative to the output directory and uses `/`.
 * The interface itself has no images outside `public/`, so every image under `_astro/` is content.
 */
export function isIllustration(file: string): boolean {
  return file.startsWith('_astro/') && /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file);
}

/** Build output the service worker caches on install. Illustrations wait until their page is opened. */
export function isPrecacheable(file: string): boolean {
  return (
    file !== serviceWorkerFile &&
    !file.endsWith('.map') &&
    !file.split('/').some((segment) => segment.startsWith('.')) &&
    !isIllustration(file)
  );
}

/** The URL a build output file is served from under `trailingSlash: 'always'`. */
export function fileToUrl(base: string, file: string): string {
  const directory = file === 'index.html' ? '' : file.endsWith('/index.html') ? file.slice(0, -'index.html'.length) : undefined;
  return `${siteRoot(base)}${directory ?? file}`;
}

export function revisionOf(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

export interface PrecacheEntry {
  url: string;
  revision: string;
}

export function buildPrecacheManifest(
  base: string,
  files: readonly { path: string; content: Uint8Array }[],
): PrecacheEntry[] {
  return files
    .filter(({ path }) => isPrecacheable(path))
    .map(({ path, content }) => ({ url: fileToUrl(base, path), revision: revisionOf(content) }))
    .toSorted((a, b) => a.url.localeCompare(b.url));
}

/** URLs of the current illustrations. Their names carry a content hash, so they need no revision. */
export function buildIllustrationList(base: string, files: readonly string[]): string[] {
  return files.filter(isIllustration).map((file) => fileToUrl(base, file)).toSorted();
}

/** Prepends the build-specific constants to the service worker template. */
export function serviceWorkerSource(
  template: string,
  base: string,
  precache: readonly PrecacheEntry[],
  illustrations: readonly string[],
): string {
  return [
    `const BASE = ${JSON.stringify(siteRoot(base))};`,
    `const OFFLINE_PAGES = ${JSON.stringify(offlinePages(base))};`,
    `const PRECACHE = ${JSON.stringify(precache)};`,
    `const ILLUSTRATIONS = ${JSON.stringify(illustrations)};`,
    '',
    template,
  ].join('\n');
}
