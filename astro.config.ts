import { unified as markdownRemark } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';

import pwa from './src/integrations/pwa';
import rehypeResponsiveTables from './src/lib/rehype-responsive-tables';
import remarkDetails from './src/lib/remark-details';

export default defineConfig({
  site: 'https://albburtsev.github.io',
  base: '/explained',
  trailingSlash: 'always',
  integrations: [pwa()],
  markdown: {
    processor: markdownRemark({
      remarkPlugins: [remarkGfm, remarkDirective, remarkDetails],
      rehypePlugins: [rehypeResponsiveTables, rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
    }),
    shikiConfig: {
      themes: { light: 'github-light-default', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: true,
    },
  },
});
