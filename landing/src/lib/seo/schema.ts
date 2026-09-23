import { AUTHOR, CONTACT, DESCRIPTION, ISSUES_URL, RELEASES_URL, REPO_URL, SITE_NAME, SITE_URL } from "../site";
import { ogImageUrl } from "./metadata";
import type { Section, SeoPage } from "./types";

/**
 * schema.org graphs. Google says structured data is not required for its AI features, but the
 * other answer engines and every classic rich result still read it, and it costs nothing to be
 * precise about what this site is describing.
 */

type Json = Record<string, unknown>;

export const IDS = {
  website: `${SITE_URL}/#website`,
  author: `${SITE_URL}/#author`,
  publisher: `${SITE_URL}/#publisher`,
  app: `${SITE_URL}/#app`,
};

/** The nodes every page carries: the site, who publishes it, and the application it describes. */
export function coreNodes(version: string | null): Json[] {
  return [
    {
      "@type": "WebSite",
      "@id": IDS.website,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: ["Helicon ADE", "Helicon for Muse Code"],
      description: DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": IDS.publisher },
      about: { "@id": IDS.app },
      // /search renders on the server from ?q=, so this is a real endpoint, not a promise.
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Person",
      "@id": IDS.author,
      name: AUTHOR.name,
      url: AUTHOR.url,
      sameAs: [AUTHOR.url, "https://github.com/HarjjotSinghh"],
    },
    {
      "@type": "Organization",
      "@id": IDS.publisher,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/assets/logo-light.png`,
      founder: { "@id": IDS.author },
      email: CONTACT.email,
      sameAs: [REPO_URL, "https://alternativeto.net/software/helicon/about/"],
      description:
        "Helicon is an unofficial, MIT licensed community project: a desktop and web client for Meta's Muse Code CLI. Not made, sponsored or endorsed by Meta.",
      // A real address and real ways to reach a person. An answer engine asked "who publishes
      // this, and can I contact them" has to be able to answer without leaving the page.
      address: {
        "@type": "PostalAddress",
        addressLocality: CONTACT.address.locality,
        addressRegion: CONTACT.address.region,
        addressCountry: CONTACT.address.country,
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT.email,
          url: `${SITE_URL}/contact`,
          areaServed: "Worldwide",
          availableLanguage: ["English"],
        },
        {
          "@type": "ContactPoint",
          contactType: "technical support",
          url: ISSUES_URL,
          email: CONTACT.email,
          areaServed: "Worldwide",
          availableLanguage: ["English"],
        },
        {
          "@type": "ContactPoint",
          contactType: "security",
          url: CONTACT.security,
          email: CONTACT.email,
          areaServed: "Worldwide",
          availableLanguage: ["English"],
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": IDS.app,
      name: SITE_NAME,
      alternateName: ["Muse Code GUI", "Muse Code desktop app"],
      description: DESCRIPTION,
      url: `${SITE_URL}/`,
      image: `${SITE_URL}/opengraph-image`,
      applicationCategory: "DeveloperApplication",
      applicationSubCategory: "AI coding agent interface",
      operatingSystem: "Windows 10, Windows 11, macOS, Linux",
      softwareVersion: version ?? undefined,
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      // The real artifact, not the /download redirect, which robots.txt keeps crawlers out of.
      downloadUrl: RELEASES_URL,
      installUrl: `${SITE_URL}/install`,
      releaseNotes: `${REPO_URL}/releases`,
      codeRepository: REPO_URL,
      programmingLanguage: ["TypeScript", "Rust"],
      softwareRequirements: "The muse CLI, installed and signed in. Node.js is bundled in the desktop app.",
      featureList: [
        "Projects and sessions grouped by working directory, git worktrees included",
        "Resume any session, including sessions started in the muse terminal TUI",
        "Inline diffs in the thread at the turn that produced them",
        "Every agent approval surfaced, never bypassed",
        "Cost at published API rates per thread, day and model",
        "The 5 hour window and weekly cap as Muse Code reports them",
        "Command palette, slash commands, model and reasoning-effort picker",
        "File viewer with source, Markdown, image, video and PDF preview",
        "Tauri desktop app and web app on the same React UI",
        "Remote daemon support for running the agent on another machine",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/pricing`,
      },
      author: { "@id": IDS.author },
      publisher: { "@id": IDS.publisher },
      maintainer: { "@id": IDS.author },
      sameAs: [REPO_URL],
      isBasedOn: "https://developer.meta.com/ai/products/muse-code",
    },
  ];
}

function breadcrumb(trail: { name: string; slug: string }[]): Json {
  return {
    "@type": "BreadcrumbList",
    "@id": `${SITE_URL}/${trail[trail.length - 1]?.slug ?? ""}#breadcrumb`,
    itemListElement: [{ name: "Home", slug: "" }, ...trail].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}/${item.slug}`,
    })),
  };
}

function faqNode(id: string, faqs: { q: string; a: string }[]): Json {
  return {
    "@type": "FAQPage",
    "@id": id,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/**
 * The page type that fits each page, so the graph says what the page actually is. HowToPage is
 * claimed only when the page carries steps: a HowToPage with no HowTo node in it is a lie the
 * rich results test will not catch and a model will.
 */
function pageTypeFor(page: SeoPage): string {
  if (page.section === "glossary") return "DefinedTermSet";
  if (page.howTo) return "HowToPage";
  return "WebPage";
}

export function pageGraph(page: SeoPage, version: string | null, trail: { name: string; slug: string }[]): Json {
  const url = `${SITE_URL}/${page.slug}`;
  const nodes: Json[] = [
    ...coreNodes(version),
    breadcrumb(trail),
    {
      "@type": pageTypeFor(page),
      "@id": `${url}#page`,
      url,
      name: page.title,
      headline: page.h1,
      description: page.answer,
      abstract: page.description,
      inLanguage: "en",
      isPartOf: { "@id": IDS.website },
      about: { "@id": IDS.app },
      dateModified: page.updated,
      datePublished: page.updated,
      author: { "@id": IDS.author },
      publisher: { "@id": IDS.publisher },
      breadcrumb: { "@id": `${url}#breadcrumb` },
      primaryImageOfPage: ogImageUrl(page.h1, page.description, page.ogEyebrow ?? SITE_NAME),
      keywords: page.keywords.join(", "),
      // The answer paragraph is the passage worth reading aloud, and the passage worth quoting.
      speakable: { "@type": "SpeakableSpecification", cssSelector: ["[data-answer]"] },
      significantLink: (page.related ?? []).map((slug) => `${SITE_URL}/${slug}`),
      encoding: {
        "@type": "MediaObject",
        encodingFormat: "text/markdown",
        contentUrl: `${url}.md`,
      },
    },
  ];

  if (page.section === "glossary") {
    nodes.push({
      "@type": "DefinedTerm",
      "@id": `${url}#term`,
      name: page.label,
      description: page.answer,
      inDefinedTermSet: `${url}#page`,
      url,
    });
  }

  if (page.section === "compare") {
    nodes.push({
      "@type": "Article",
      "@id": `${url}#article`,
      headline: page.h1,
      description: page.answer,
      articleSection: "Comparison",
      url,
      dateModified: page.updated,
      datePublished: page.updated,
      author: { "@id": IDS.author },
      publisher: { "@id": IDS.publisher },
      isPartOf: { "@id": `${url}#page` },
      about: { "@id": IDS.app },
      inLanguage: "en",
    });
  }

  if (page.section === "features" || page.section === "use-cases") {
    nodes.push({
      "@type": "TechArticle",
      "@id": `${url}#article`,
      headline: page.h1,
      description: page.answer,
      url,
      dateModified: page.updated,
      datePublished: page.updated,
      author: { "@id": IDS.author },
      publisher: { "@id": IDS.publisher },
      isPartOf: { "@id": `${url}#page` },
      about: { "@id": IDS.app },
      proficiencyLevel: "Beginner",
      inLanguage: "en",
    });
  }

  if (page.howTo) {
    nodes.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: page.howTo.name,
      description: page.answer,
      totalTime: "PT10M",
      estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "0" },
      tool: [{ "@type": "HowToTool", name: "The muse CLI, installed and signed in" }],
      step: page.howTo.steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.code ? `${step.text} Command: ${step.code}` : step.text,
        url: `${url}#step-${index + 1}`,
      })),
    });
  }

  if (page.itemList) {
    nodes.push({
      "@type": "ItemList",
      "@id": `${url}#list`,
      name: page.itemList.name,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: page.itemList.items.length,
      itemListElement: page.itemList.items.map((name, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
      })),
    });
  }

  if (page.faqs?.length) nodes.push(faqNode(`${url}#faq`, page.faqs));

  return { "@context": "https://schema.org", "@graph": nodes };
}

export function sectionGraph(section: Section, pages: SeoPage[], version: string | null): Json {
  const url = `${SITE_URL}/${section.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...coreNodes(version),
      breadcrumb([{ name: section.label, slug: section.slug }]),
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: section.title,
        headline: section.h1,
        description: section.answer,
        inLanguage: "en",
        isPartOf: { "@id": IDS.website },
        about: { "@id": IDS.app },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        speakable: { "@type": "SpeakableSpecification", cssSelector: ["[data-answer]"] },
        keywords: section.keywords.join(", "),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: pages.length,
          itemListElement: pages.map((page, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: page.label,
            description: page.description,
            url: `${SITE_URL}/${page.slug}`,
          })),
        },
      },
    ],
  };
}

/** Serialise a graph so it can never close the script tag it lives in. */
export function jsonLd(graph: Json): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
