import { releaseNotes, type ChangeGroups, type ReleaseNotes } from "../github-release";
import { SITE_NAME, SITE_URL } from "../site";

/**
 * RSS 2.0 and Atom 1.0 for the changelog. Both are built from the same commit-derived release
 * notes the /changelog page renders, so a feed reader sees exactly what the page says: Added,
 * Fixed, Changed and Removed per release, not the installation boilerplate GitHub stores in every
 * release body.
 */

const SECTIONS: Array<[keyof ChangeGroups, string]> = [
  ["added", "Added"],
  ["fixed", "Fixed"],
  ["changed", "Changed"],
  ["removed", "Removed"],
];

const FEED_TITLE = `${SITE_NAME} releases`;
const FEED_SUBTITLE = "Every Helicon release: what was added, fixed, changed and removed.";

function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The body of one release as HTML, which both formats carry escaped inside the XML. */
function releaseHtml(release: ReleaseNotes) {
  const present = SECTIONS.filter(([key]) => release.changes[key].length);
  if (!present.length) return `<p>Packaging and release plumbing only.</p>`;
  return present
    .map(([key, label]) => {
      const items = release.changes[key]
        .map((c) => {
          const pr = c.pr ? ` (<a href="https://github.com/HarjjotSinghh/helicon/pull/${c.pr}">#${c.pr}</a>)` : "";
          return `<li>${escape(c.text)}${pr}</li>`;
        })
        .join("");
      return `<h3>${label}</h3><ul>${items}</ul>`;
    })
    .join("");
}

function summaryText(release: ReleaseNotes) {
  const counts = SECTIONS.filter(([key]) => release.changes[key].length).map(
    ([key, label]) => `${release.changes[key].length} ${label.toLowerCase()}`,
  );
  return counts.length ? counts.join(", ") : "Packaging only";
}

const entryUrl = (release: ReleaseNotes) => `${SITE_URL}/changelog#v${release.version}`;

export async function rssFeed() {
  const releases = await releaseNotes(20);
  const updated = releases[0]?.publishedAt ? new Date(releases[0].publishedAt) : new Date();
  const items = releases
    .map(
      (r) => `    <item>
      <title>${escape(r.name)}</title>
      <link>${entryUrl(r)}</link>
      <guid isPermaLink="true">${escape(r.notesUrl)}</guid>
      <pubDate>${new Date(r.publishedAt).toUTCString()}</pubDate>
      <description>${escape(releaseHtml(r))}</description>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(FEED_TITLE)}</title>
    <link>${SITE_URL}/changelog</link>
    <description>${escape(FEED_SUBTITLE)}</description>
    <language>en</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/brand/pfp-1024-light.png</url>
      <title>${escape(FEED_TITLE)}</title>
      <link>${SITE_URL}/changelog</link>
    </image>
${items}
  </channel>
</rss>
`;
}

export async function atomFeed() {
  const releases = await releaseNotes(20);
  const updated = releases[0]?.publishedAt ?? new Date().toISOString();
  const entries = releases
    .map(
      (r) => `  <entry>
    <id>${escape(r.notesUrl)}</id>
    <title>${escape(r.name)}</title>
    <link rel="alternate" type="text/html" href="${entryUrl(r)}" />
    <link rel="related" type="text/html" href="${escape(r.notesUrl)}" />
    <published>${r.publishedAt}</published>
    <updated>${r.publishedAt}</updated>
    <summary>${escape(summaryText(r))}</summary>
    <content type="html">${escape(releaseHtml(r))}</content>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${SITE_URL}/changelog</id>
  <title>${escape(FEED_TITLE)}</title>
  <subtitle>${escape(FEED_SUBTITLE)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}/atom.xml" />
  <link rel="alternate" type="text/html" href="${SITE_URL}/changelog" />
  <updated>${updated}</updated>
  <author><name>Harjot Singh Rana</name><uri>https://harjotrana.com</uri></author>
  <icon>${SITE_URL}/brand/pfp-1024-light.png</icon>
  <rights>MIT</rights>
${entries}
</feed>
`;
}
