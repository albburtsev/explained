import { unified as markdownRemark } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

export default defineConfig({
  site: 'https://albburtsev.github.io',
  base: '/explained',
  trailingSlash: 'always',
  markdown: {
    processor: markdownRemark({
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]],
    }),
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
  },
});
