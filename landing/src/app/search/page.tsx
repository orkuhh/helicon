import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { Breadcrumbs } from "@/components/seo/doc-page";
import { DocShell } from "@/components/seo/doc-shell";
import { IconTile } from "@/components/seo/icons";
import { Rule, bandX, buttonClass, cn } from "@/components/ui";
import { SECTIONS } from "@/lib/seo/catalog";
import { coreNodes, jsonLd, IDS } from "@/lib/seo/schema";
import { buildSearchIndex, searchDocs } from "@/lib/seo/search";
import { latestRelease } from "@/lib/github-release";
import { SITE_URL } from "@/lib/site";

/**
 * Site search. Rendered on the server from the query string, so it works without JavaScript and
 * is the real target of the SearchAction in the schema graph. Result pages are not indexed: a
 * search results page is thin by definition, and Google says so in its guidelines.
 */

export const metadata: Metadata = {
  title: "Search",
  description: "Search every Helicon page: install guides, comparisons, features, guides and definitions.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

// Built once per server instance rather than per request: the content only changes on deploy.
const INDEX = buildSearchIndex();

const SUGGESTIONS = ["windows", "resume a session", "approvals", "cost", "wsl2", "vs code"];

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 120).trim();
  const hits = query ? searchDocs(INDEX, query, 30) : [];
  const release = await latestRelease();
  const version = release?.version ?? null;
  const url = `${SITE_URL}/search`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      ...coreNodes(version),
      {
        "@type": "SearchResultsPage",
        "@id": `${url}#page`,
        url,
        name: query ? `Search results for ${query}` : "Search",
        isPartOf: { "@id": IDS.website },
        inLanguage: "en",
      },
    ],
  };

  return (
    <DocShell version={version} jsonLdString={jsonLd(graph)}>
      <div className={cn(bandX, "py-10 sm:py-14")}>
        <Breadcrumbs trail={[{ name: "Search", slug: "search" }]} />
        <IconTile name="search" lead className="mt-6" />
        <h1 className="mt-4 font-headline text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-fg">
          Search
        </h1>

        <form action="/search" method="get" role="search" className="mt-6 flex max-w-[640px] gap-2">
          <label htmlFor="site-search-q" className="sr-only">
            Search helicon.sh
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] bg-surface px-3.5 shadow-[inset_0_0_0_1px_var(--border-strong)] focus-within:shadow-[inset_0_0_0_1px_var(--accent)]">
            <MagnifyingGlass aria-hidden="true" className="size-[18px] shrink-0 text-subtle" />
            <input
              id="site-search-q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Install, compare, approvals, cost…"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-subtle"
            />
          </div>
          <button type="submit" className={buttonClass("primary", "md")}>
            Search
          </button>
        </form>

        {query ? (
          <p className="mt-6 text-[14px] text-subtle" aria-live="polite">
            {hits.length === 0
              ? `Nothing matches “${query}”.`
              : `${hits.length === 30 ? "30+" : hits.length} result${hits.length === 1 ? "" : "s"} for “${query}”`}
          </p>
        ) : null}

        {hits.length ? (
          <ol className="mt-4 max-w-[760px] divide-y divide-line border-y border-line">
            {hits.map((hit) => (
              <li key={hit.url}>
                <Link href={hit.url} className="group flex gap-4 py-5 transition-colors">
                  <IconTile name={hit.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-subtle">{hit.section}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[16px] font-medium text-fg group-hover:text-accent-text">
                      {hit.title}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-muted">{hit.snippet}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : null}

        {!hits.length ? (
          <div className="mt-10 max-w-[760px]">
            <h2 className="text-[13px] font-semibold text-fg">{query ? "Try one of these" : "Popular searches"}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <Link href={`/search?q=${encodeURIComponent(s)}`} className={buttonClass("outline", "sm")}>
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
            <h2 className="mt-10 text-[13px] font-semibold text-fg">Or browse by section</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SECTIONS.map((section) => (
                <li key={section.id} className="rounded-xl shadow-[inset_0_0_0_1px_var(--border)]">
                  <Link href={`/${section.slug}`} className="group flex items-center gap-3 rounded-xl p-4 hover:bg-sunken">
                    <IconTile name={section.icon} />
                    <span className="text-[15px] font-medium text-fg">{section.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <Rule />
    </DocShell>
  );
}
