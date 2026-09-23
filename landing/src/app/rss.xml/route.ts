import { rssFeed } from "@/lib/seo/feeds";

/** RSS 2.0 for the changelog. Refreshed hourly; a release is rarely more urgent than that. */
export const revalidate = 3600;

export async function GET() {
  return new Response(await rssFeed(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
