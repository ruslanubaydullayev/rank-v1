import { posts } from "~~/app/data/blog";

/**
 * Dynamic sitemap source for blog posts (consumed by @nuxtjs/sitemap).
 * Static routes (/, /pricing, /blog) are discovered automatically.
 */
export default defineSitemapEventHandler(() => {
  return posts.map((p) => ({
    loc: `/blog/${p.slug}`,
    lastmod: p.datePublished,
    changefreq: "monthly" as const,
    priority: 0.7,
  }));
});
