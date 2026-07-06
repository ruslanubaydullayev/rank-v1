export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO
  author: string;
  readingMinutes: number;
  /** Simple HTML body for the MVP. Swap for @nuxt/content later if needed. */
  body: string;
}

/**
 * Seed blog content. This is the reserved content model (spec §8.6) so /blog
 * exists from day one and isn't a later migration. Add posts here (or move to
 * a CMS / @nuxt/content) — pages, sitemap and Article schema pick them up.
 */
export const posts: BlogPost[] = [
  {
    slug: "how-to-make-a-ranking-video",
    title: "How to Make a Ranking Video (The Easy Way)",
    description:
      "A step-by-step guide to making a ranking video from TikTok and Instagram clips — no editing software required.",
    datePublished: "2026-01-15T09:00:00.000Z",
    author: "Ranking Shorts Team",
    readingMinutes: 4,
    body: `
      <p>Ranking videos are everywhere — top 5 goals, funniest fails, best moments. Here's how to make one in minutes.</p>
      <h2>1. Collect your clips</h2>
      <p>Gather the clips you want to rank. You can paste TikTok or Instagram links, or upload videos straight from your phone.</p>
      <h2>2. Decide the order</h2>
      <p>The ranking is the point. Drag your clips into the order you want, from #1 to last.</p>
      <h2>3. Label each clip</h2>
      <p>Give every clip a short caption so viewers know what they're looking at.</p>
      <h2>4. Add a title and render</h2>
      <p>Add an overall title, hit generate, and download your finished vertical video. That's it.</p>
      <p><a href="/create">Try it now →</a></p>
    `,
  },
  {
    slug: "tiktok-ranking-video-maker",
    title: "The Best TikTok Ranking Video Maker for 2026",
    description:
      "Looking for a fast way to turn TikTok clips into a ranked short? Here's what to look for in a ranking video maker.",
    datePublished: "2026-02-02T09:00:00.000Z",
    author: "Ranking Shorts Team",
    readingMinutes: 5,
    body: `
      <p>Not all ranking tools are created equal. Here's what actually matters when picking a TikTok ranking video maker.</p>
      <h2>Import from links</h2>
      <p>The best tools let you paste a link instead of downloading and re-uploading every clip.</p>
      <h2>Automatic formatting</h2>
      <p>Vertical 9:16 output, numbered badges, and captions should be handled for you.</p>
      <h2>Fast rendering</h2>
      <p>You shouldn't wait minutes. A good tool renders in seconds.</p>
      <p>See how <a href="/">Ranking Shorts</a> compares, or check <a href="/pricing">pricing</a>.</p>
    `,
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
