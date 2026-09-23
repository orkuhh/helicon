import { ALL_PAGES, SECTIONS } from "./catalog";
import { FAQ_PAGE_META, faqGroups } from "./faq";
import type { Block } from "./types";
import type { SearchDoc } from "./search-core";

/**
 * Site search. One index, one scorer, used in two places: the /search page, which renders on the
 * server and works without JavaScript (it is also the SearchAction target in the schema graph),
 * and the ⌘K palette, which loads the same index as JSON the first time it opens.
 *
 * Seventy-odd pages do not need a search engine. A weighted token match over fields that are
 * already written for people is enough, and it keeps the whole thing free of dependencies.
 */

function blockText(block: Block): string {
  switch (block.kind) {
    case "p":
    case "h2":
    case "h3":
    case "note":
    case "quote":
      return block.text;
    case "ul":
    case "ol":
      return block.items.join(" ");
    case "table":
      return [...block.head, ...block.rows.flat()].join(" ");
    case "code":
      return block.code;
    case "steps":
      return block.steps.map((s) => `${s.name} ${s.text}`).join(" ");
    case "stats":
      return block.items.map((s) => `${s.value} ${s.label}`).join(" ");
  }
}

/** Markdown spellings in the content are for rendering, not for matching. */
function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchIndex({ withBody = true }: { withBody?: boolean } = {}): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const page of ALL_PAGES) {
    const section = SECTIONS.find((s) => s.id === page.section);
    docs.push({
      url: `/${page.slug}`,
      title: page.label,
      section: section?.label ?? "Overview",
      description: page.description,
      icon: page.icon,
      head: plain([page.label, page.h1, page.title, ...page.keywords].join(" ")),
      mid: plain([page.answer, ...(page.faqs ?? []).map((f) => f.q)].join(" ")),
      ...(withBody
        ? {
            body: plain(
              [
                ...page.blocks.map(blockText),
                ...(page.howTo?.steps ?? []).map((s) => `${s.name} ${s.text}`),
                ...(page.faqs ?? []).map((f) => f.a),
              ].join(" "),
            ),
          }
        : {}),
    });
  }

  for (const section of SECTIONS) {
    docs.push({
      url: `/${section.slug}`,
      title: section.h1,
      section: "Section",
      description: section.description,
      icon: section.icon,
      head: plain([section.label, section.h1, section.title, ...section.keywords].join(" ")),
      mid: plain([section.answer, section.intro].join(" ")),
    });
  }

  const faqs = faqGroups().flatMap((g) => g.faqs);
  docs.push({
    url: "/faq",
    title: "Frequently asked questions",
    section: "Help",
    description: FAQ_PAGE_META.description,
    icon: "question",
    head: plain([FAQ_PAGE_META.h1, FAQ_PAGE_META.title, ...FAQ_PAGE_META.keywords].join(" ")),
    mid: plain(faqs.map((f) => f.q).join(" ")),
    ...(withBody ? { body: plain(faqs.map((f) => f.a).join(" ")) } : {}),
  });

  docs.push({
    url: "/changelog",
    title: "Changelog",
    section: "Help",
    description: "Every Helicon release, newest first, with what was added, fixed, changed and removed.",
    icon: "clock",
    head: "changelog releases release notes versions updates what changed",
    mid: "added fixed changed removed windows installer macos dmg linux appimage auto update",
  });

  return docs;
}

export { searchDocs, tokenize, type SearchDoc, type SearchHit } from "./search-core";
