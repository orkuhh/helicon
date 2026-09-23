import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Inter, JetBrains_Mono, Manrope, Newsreader } from "next/font/google";
import { FontPicker } from "@/components/font-picker";
import { GoogleAnalytics } from "@/components/analytics-scripts";
import { AUTHOR, DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_URL, TAGLINE, TITLE } from "@/lib/site";
import "./globals.css";

// Landing typefaces: Instrument Sans for headings, Manrope for everything else.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

/*
 * The product's own faces, used by the live app demos, which exist only on the home page.
 * They are declared here because the CSS variables are global, but `preload: false` keeps them
 * out of every page's <head>: together they are ~200 KB, and preloading them on a text page
 * costs the answer paragraph its LCP on a throttled connection for fonts nothing there uses.
 * The browser still fetches them the moment a demo actually asks for them.
 */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  preload: false,
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  category: "Developer tools",
  keywords: SITE_KEYWORDS,
  alternates: {
    // Next normalises this to the bare origin; the sitemap's home entry matches it exactly.
    canonical: SITE_URL,
    types: {
      "text/plain": [{ url: "/llms.txt", title: "llms.txt" }],
      "text/markdown": [{ url: "/agents.md", title: "AGENTS.md" }],
      "application/json": [{ url: "/facts.json", title: "Checkable facts about Helicon" }],
      "application/rss+xml": [{ url: "/rss.xml", title: "Helicon releases (RSS)" }],
      "application/atom+xml": [{ url: "/atom.xml", title: "Helicon releases (Atom)" }],
    },
  },
  // Search Console and Webmaster Tools verification. Set the env vars once per property; an
  // unset var leaves the tag out entirely rather than emitting an empty one.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    other: {
      ...(process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : {}),
      ...(process.env.NAVER_SITE_VERIFICATION ? { "naver-site-verification": process.env.NAVER_SITE_VERIFICATION } : {}),
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: TITLE,
    description: `${TAGLINE} A free, open-source desktop and web app for the muse CLI.`,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: `${TAGLINE} Free and MIT licensed.`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  formatDetection: { telephone: false, email: false, address: false },
  other: {
    // Read by a few answer engines and by people reading view-source. Harmless to the rest.
    "ai-content-declaration": "human-authored",
    "llms-txt": `${SITE_URL}/llms.txt`,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#18191b" },
  ],
  viewportFit: "cover",
};

// Runs before first paint: a saved choice wins, otherwise the system theme.
const themeScript = `(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem("helicon-theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t)})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${manrope.variable} ${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <GoogleAnalytics />
        {process.env.NODE_ENV === "development" ? <FontPicker /> : null}
      </body>
    </html>
  );
}
