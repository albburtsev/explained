import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  appIconSvg,
  buildIllustrationList,
  buildPrecacheManifest,
  buildWebManifest,
  fileToUrl,
  isIllustration,
  isPrecacheable,
  logo,
  offlinePages,
  serviceWorkerSource,
  themeColors,
} from '../src/lib/pwa';
import favicon from '../public/favicon.svg?raw';

const encode = (text: string) => new TextEncoder().encode(text);

describe('precache manifest', () => {
  it('maps build files to the URLs they are served from', () => {
    expect(fileToUrl('/explained', 'index.html')).toBe('/explained/');
    expect(fileToUrl('/explained/', 'ru/courses/git/submodules/index.html')).toBe('/explained/ru/courses/git/submodules/');
    expect(fileToUrl('/explained', 'ru/search-index.json')).toBe('/explained/ru/search-index.json');
    expect(fileToUrl('/', '_astro/page.abc123.js')).toBe('/_astro/page.abc123.js');
  });

  it('skips the service worker, source maps, and hidden files', () => {
    expect(isPrecacheable('sw.js')).toBe(false);
    expect(isPrecacheable('_astro/page.abc123.js.map')).toBe(false);
    expect(isPrecacheable('.well-known/security.txt')).toBe(false);
    expect(isPrecacheable('_astro/page.abc123.js')).toBe(true);
    expect(isPrecacheable('icons/icon-192.png')).toBe(true);
    expect(isPrecacheable('favicon.svg')).toBe(true);
  });

  it('leaves illustrations for the page that shows them', () => {
    expect(isIllustration('_astro/iceberg-metadata-tree.BDp9hro__87ud5.webp')).toBe(true);
    expect(isIllustration('_astro/orca-main-window.abc.JPG')).toBe(true);
    expect(isIllustration('_astro/page.abc123.js')).toBe(false);
    expect(isIllustration('icons/icon-192.png')).toBe(false);
    expect(isPrecacheable('_astro/iceberg-metadata-tree.BDp9hro__87ud5.webp')).toBe(false);
    expect(buildIllustrationList('/explained', ['index.html', '_astro/b.webp', '_astro/a.png', '_astro/page.js'])).toEqual([
      '/explained/_astro/a.png',
      '/explained/_astro/b.webp',
    ]);
  });

  it('revisions follow file content', () => {
    const manifest = buildPrecacheManifest('/explained', [
      { path: 'sw.js', content: encode('worker') },
      { path: 'ru/index.html', content: encode('Главная') },
      { path: 'index.html', content: encode('Home') },
      { path: 'offline/index.html', content: encode('Home') },
    ]);

    expect(manifest.map(({ url }) => url)).toEqual(['/explained/', '/explained/offline/', '/explained/ru/']);
    expect(manifest[0]?.revision).toMatch(/^[0-9a-f]{12}$/);
    expect(manifest[0]?.revision).toBe(manifest[1]?.revision);
    expect(manifest[2]?.revision).not.toBe(manifest[0]?.revision);
  });

  it('prepends build constants to the service worker template', () => {
    const source = serviceWorkerSource('// template', '/explained', [{ url: '/explained/', revision: 'abc' }], [
      '/explained/_astro/a.webp',
    ]);
    expect(source).toContain('const BASE = "/explained/";');
    expect(source).toContain('const PRECACHE = [{"url":"/explained/","revision":"abc"}];');
    expect(source).toContain('const ILLUSTRATIONS = ["/explained/_astro/a.webp"];');
    expect(source.endsWith('// template')).toBe(true);
  });

  it('matches the Russian offline page before the default one', () => {
    expect(offlinePages('/explained')).toEqual([
      ['/explained/ru/', '/explained/ru/offline/'],
      ['/explained/', '/explained/offline/'],
    ]);
  });
});

describe('web app manifest', () => {
  it('describes one app that starts on the home page of each locale', () => {
    const en = buildWebManifest('/explained', 'en');
    const ru = buildWebManifest('/explained', 'ru');

    expect(en.id).toBe('/explained/');
    expect(ru.id).toBe(en.id);
    expect(ru.scope).toBe(en.scope);
    expect([en.start_url, ru.start_url]).toEqual(['/explained/', '/explained/ru/']);
    expect([en.lang, ru.lang]).toEqual(['en', 'ru']);
    expect(ru.description).not.toBe(en.description);
    expect(en.icons.map(({ src, purpose }) => [src, purpose])).toEqual([
      ['/explained/icons/icon-192.png', 'any'],
      ['/explained/icons/icon-512.png', 'any'],
      ['/explained/icons/icon-maskable-512.png', 'maskable'],
    ]);
  });

  it('uses the page background of each theme', () => {
    // Vitest stubs CSS imports, so read the stylesheet from disk.
    const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
    const backgrounds = [...css.matchAll(/--color-background:\s*(#[0-9a-f]{6})/gi)].map(([, color]) => color);
    expect(backgrounds).toEqual([themeColors.dark, themeColors.light]);
  });

  it('draws the app icons from the favicon logo', () => {
    for (const value of Object.values(logo)) expect(favicon).toContain(value);
    expect(appIconSvg(false)).toContain('rx="16"');
    expect(appIconSvg(true)).not.toContain('rx=');
  });
});
