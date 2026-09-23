import { atomFeed } from "@/lib/seo/feeds";

/** Atom 1.0 for the changelog. Same entries as /rss.xml; some readers only handle one. */
export const revalidate = 3600;

export async function GET() {
  return new Response(await atomFeed(), {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}
