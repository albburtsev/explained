import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { appIcons, appIconSvg, type AppIcon } from '../../lib/pwa';

export const getStaticPaths = (() => appIcons.map((icon) => ({ params: { icon: icon.name }, props: icon }))) satisfies GetStaticPaths;

export const GET: APIRoute<AppIcon> = async ({ props: { size, maskable } }) => {
  // The SVG has a 64-unit view box; render it at the target size instead of scaling a small bitmap.
  const png = await sharp(Buffer.from(appIconSvg(maskable)), { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
