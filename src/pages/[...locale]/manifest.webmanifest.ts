import type { APIRoute, GetStaticPaths } from 'astro';
import { localeStaticPaths, type Locale } from '../../lib/i18n';
import { buildWebManifest } from '../../lib/pwa';

export const getStaticPaths = (() => localeStaticPaths()) satisfies GetStaticPaths;

export const GET: APIRoute<{ locale: Locale }> = ({ props: { locale } }) =>
  new Response(JSON.stringify(buildWebManifest(import.meta.env.BASE_URL, locale)), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
