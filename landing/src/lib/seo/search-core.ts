import type { IconKey } from "./types";

/**
 * The pure half of site search: the document shape and the scorer. Nothing here imports page
 * content, so the ⌘K palette can use it without shipping 78 pages of text to every visitor. The
 * index itself is built on the server in search.ts and fetched as JSON.
 */

export type SearchDoc = {
  url: string;
  title: string;
  section: string;
  description: string;
  icon: IconKey;
  /** Short, high-signal fields: label, h1, keywords. */
  head: string;
  /** The answer paragraph and the FAQ questions. */
  mid: string;
  /** Everything else on the page. Left out of the client index to keep it small. */
  body?: string;
};

export type SearchHit = SearchDoc & { score: number; snippet: string };

// Words that appear on nearly every page carry no signal and would flatten the ranking.
const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "how", "i",
  "in", "is", "it", "me", "my", "of", "on", "or", "the", "to", "what", "with", "you", "your",
]);

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9.+#-]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function countWord(haystack: string, token: string, prefix: boolean) {
  // A whole-word hit is worth more than a substring inside another word ("app" in "approvals").
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = new RegExp(`(^|[^a-z0-9])${escaped}${prefix ? "" : "(?![a-z0-9])"}`, "g");
  return (haystack.match(word) ?? []).length;
}

/**
 * The sentence that best explains why this page matched. The description is tried first because
 * it was written to be read alone; then the answer paragraph; then the body. A whole sentence
 * reads better than a window cut out of the middle of one.
 */
function snippetFor(doc: SearchDoc, tokens: string[]): string {
  const sources = [doc.description, doc.mid, doc.body ?? ""];
  // "approvals" should find the sentence that says "approval". Plural stripping is crude and
  // enough: this only picks which sentence to show, not what ranks.
  const stems = [...new Set(tokens.flatMap((t) => [t, t.length > 4 ? t.replace(/e?s$/, "") : t]))];
  for (const source of sources) {
    if (!source) continue;
    const sentences = source.split(/(?<=[.!?])\s+/);
    const hit = sentences.find((sentence) => {
      const lower = sentence.toLowerCase();
      return stems.some((t) => lower.includes(t));
    });
    if (hit) return hit.length > 180 ? `${hit.slice(0, 178).trimEnd()}…` : hit;
  }
  return doc.description;
}

/**
 * Ranks documents against a query. Every token has to appear somewhere in the document, so a
 * two-word search narrows rather than widens; the last token matches as a prefix, because the
 * palette searches while you type.
 */
export function searchDocs(docs: SearchDoc[], query: string, limit = 20): SearchHit[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const phrase = query.trim().toLowerCase();

  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const head = doc.head.toLowerCase();
    const title = doc.title.toLowerCase();
    const mid = doc.mid.toLowerCase();
    const desc = doc.description.toLowerCase();
    const body = (doc.body ?? "").toLowerCase();

    let score = 0;
    let matchedAll = true;
    tokens.forEach((token, i) => {
      const prefix = i === tokens.length - 1;
      const inTitle = countWord(title, token, prefix);
      const inHead = countWord(head, token, prefix);
      const inMid = countWord(mid, token, prefix);
      const inDesc = countWord(desc, token, prefix);
      const inBody = countWord(body, token, prefix);
      if (!inTitle && !inHead && !inMid && !inDesc && !inBody) matchedAll = false;
      score += inTitle * 12 + Math.min(inHead, 3) * 6 + Math.min(inMid, 3) * 3 + Math.min(inDesc, 2) * 3 + Math.min(inBody, 5);
    });
    if (!matchedAll) continue;

    // The whole query appearing as written is the strongest signal there is.
    if (phrase.length > 3) {
      if (title.includes(phrase)) score += 30;
      else if (head.includes(phrase)) score += 18;
      else if (mid.includes(phrase) || desc.includes(phrase)) score += 8;
    }
    hits.push({ ...doc, score, snippet: snippetFor(doc, tokens) });
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
