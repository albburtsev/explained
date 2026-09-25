import { unified as markdownRemark } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';

import remarkDetails from './src/lib/remark-details';

export default defineConfig({
  site: 'https://albburtsev.github.io',
  base: '/explained',
  trailingSlash: 'always',
  markdown: {
    processor: markdownRemark({
      remarkPlugins: [remarkGfm, remarkDirective, remarkDetails],
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
    }),
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
  },
});
