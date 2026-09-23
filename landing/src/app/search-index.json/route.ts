import { buildSearchIndex } from "@/lib/seo/search";

/**
 * The index the ⌘K palette loads the first time it opens. Page bodies are left out: titles,
 * keywords, answers and FAQ questions rank well enough on their own, and the file stays small
 * enough that nobody waits for it. The /search page uses the full index on the server.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildSearchIndex({ withBody: false }), {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
