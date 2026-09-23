import type { Metadata } from "next";
import { ArrowUpRight, Rss } from "@phosphor-icons/react/ssr";
import { AnswerBlock, Breadcrumbs, PageCta } from "@/components/seo/doc-page";
import { DocShell } from "@/components/seo/doc-shell";
import { IconTile } from "@/components/seo/icons";
import { Rule, bandX, cn } from "@/components/ui";
import { ogImagePath } from "@/lib/seo/metadata";
import { coreNodes, jsonLd, IDS } from "@/lib/seo/schema";
import { latestRelease, releaseNotes, type Change, type ChangeGroups } from "@/lib/github-release";
import { RELEASES_URL, REPO_URL, SITE_NAME, SITE_URL } from "@/lib/site";

const TITLE = "Helicon changelog: every Muse Code desktop app release";
const H1 = "Changelog";
const DESCRIPTION =
  "Every Helicon release, with what changed, taken straight from GitHub. Windows installer, macOS DMG and daemon changes for the Muse Code desktop app.";
const ANSWER =
  "Every Helicon release is published on GitHub with a signed Windows installer, a universal macOS DMG and a Linux AppImage, and the app updates itself. This page lists them newest first, with what was added, fixed, changed and removed in each one, so you can read the change before it lands.";

const image = { url: ogImagePath(H1, DESCRIPTION, "Releases"), width: 1200, height: 630, alt: DESCRIPTION };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["helicon changelog", "helicon releases", "muse code gui updates", "muse code desktop app version"],
  alternates: {
    canonical: "/changelog",
    types: {
      "application/rss+xml": [{ url: "/rss.xml", title: "Helicon releases (RSS)" }],
      "application/atom+xml": [{ url: "/atom.xml", title: "Helicon releases (Atom)" }],
    },
  },
  openGraph: { type: "website", url: "/changelog", siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, images: [image] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [image] },
};

export const revalidate = 900;

const SECTIONS: Array<[keyof ChangeGroups, string]> = [
  ["added", "Added"],
  ["fixed", "Fixed"],
  ["changed", "Changed"],
  ["removed", "Removed"],
];

function ChangeItem({ change }: { change: Change }) {
  const refs = [
    ...(change.pr ? [{ label: `#${change.pr}`, n: change.pr }] : []),
    ...change.closes.filter((n) => n !== change.pr).map((n) => ({ label: `closes #${n}`, n })),
  ];
  return (
    <li className="flex gap-3 text-[15px] leading-[1.7] text-muted">
      <span aria-hidden="true" className="mt-[0.62em] size-1.5 shrink-0 rounded-full bg-accent-text/50" />
      <span className="min-w-0">
        {change.text}
        {refs.map((r) => (
          <a
            key={r.label}
            href={`${REPO_URL}/pull/${r.n}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1.5 text-[13px] text-subtle underline decoration-line-strong underline-offset-4 hover:text-fg"
          >
            {r.label}
          </a>
        ))}
      </span>
    </li>
  );
}

function Changes({ groups, commitCount }: { groups: ChangeGroups; commitCount: number }) {
  const present = SECTIONS.filter(([key]) => groups[key].length > 0);
  if (!present.length) {
    return (
      <p className="mt-3 text-[14.5px] text-subtle">
        {commitCount
          ? `${commitCount} commit${commitCount === 1 ? "" : "s"}, all of them build and release plumbing.`
          : "Packaging only."}
      </p>
    );
  }
  return (
    <div className="mt-5 space-y-5">
      {present.map(([key, label]) => (
        <section key={key}>
          <h3 className="text-[13px] font-semibold tracking-[0.06em] text-accent-text uppercase">{label}</h3>
          <ul className="mt-2.5 max-w-[72ch] space-y-2">
            {groups[key].map((change) => (
              <ChangeItem key={change.sha} change={change} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function Page() {
  const [releases, latest] = await Promise.all([releaseNotes(14), latestRelease()]);
  const version = latest?.version ?? null;
  const url = `${SITE_URL}/changelog`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      ...coreNodes(version),
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Changelog", item: url },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: TITLE,
        headline: H1,
        description: ANSWER,
        inLanguage: "en",
        isPartOf: { "@id": IDS.website },
        about: { "@id": IDS.app },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        speakable: { "@type": "SpeakableSpecification", cssSelector: ["[data-answer]"] },
        dateModified: releases[0]?.publishedAt || undefined,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: releases.length,
          itemListElement: releases.map((release, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `Helicon ${release.version}`,
            url: release.notesUrl,
          })),
        },
      },
    ],
  };

  return (
    <DocShell version={version} jsonLdString={jsonLd(graph)}>
      <div className={cn(bandX, "py-10 sm:py-14")}>
        <Breadcrumbs trail={[{ name: "Changelog", slug: "changelog" }]} />
        <IconTile name="clock" lead className="mt-6" />
        <h1 className="mt-4 max-w-[20ch] font-headline text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-fg">
          {H1}
        </h1>
        <AnswerBlock>{ANSWER}</AnswerBlock>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-subtle">
          <Rss aria-hidden="true" className="size-4 text-accent-text" />
          Subscribe:
          <a href="/rss.xml" className="underline decoration-line-strong underline-offset-4 hover:text-fg">
            RSS
          </a>
          <a href="/atom.xml" className="underline decoration-line-strong underline-offset-4 hover:text-fg">
            Atom
          </a>
          <a href="/changelog.md" className="underline decoration-line-strong underline-offset-4 hover:text-fg">
            Markdown
          </a>
        </p>

        {releases.length === 0 ? (
          <p className="mt-10 text-[15.5px] text-muted">
            GitHub is not answering right now. The releases are always at{" "}
            <a href={RELEASES_URL} className="underline decoration-line-strong underline-offset-4 hover:text-fg">
              github.com/HarjjotSinghh/helicon/releases
            </a>
            .
          </p>
        ) : (
          <ol className="mt-12 space-y-10">
            {releases.map((release) => (
              <li key={release.tag} id={`v${release.version}`} className="scroll-mt-28 border-t border-line pt-8 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-headline text-[22px] font-semibold text-fg">{release.name}</h2>
                  {release.publishedAt ? (
                    <time dateTime={release.publishedAt} className="text-[13.5px] text-subtle">
                      {formatDate(release.publishedAt)}
                    </time>
                  ) : null}
                  {release.prerelease ? (
                    <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[12px] font-medium text-fg">Pre-release</span>
                  ) : null}
                </div>
                <Changes groups={release.changes} commitCount={release.commitCount} />
                <a
                  href={release.notesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] text-subtle transition-colors hover:text-fg"
                >
                  Release on GitHub
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </a>
              </li>
            ))}
          </ol>
        )}

        <PageCta
          title="Update arrives on its own."
          body="The Windows installer and the macOS DMG both auto update. This page is here so you can read what changed before it does."
        />
      </div>
      <Rule />
    </DocShell>
  );
}
