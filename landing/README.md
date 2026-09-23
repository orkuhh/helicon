# Helicon landing page

Next.js 16 (App Router) + Tailwind v4. Deploy on Vercel with **Root Directory = `landing`**.

```sh
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Search, social and AI discovery

**[SEO.md](SEO.md) is the full map and the runbook**, including how to verify Google Search
Console and how to submit to IndexNow. The short version:

The site is the hand-written landing page plus 71 generated pages, all built from data in
`src/lib/seo/content/`. Adding an entry there creates the page, its Markdown mirror, its social
image, its schema.org graph, its sitemap entry and its internal links.

Set **`NEXT_PUBLIC_SITE_URL`** (`https://helicon.sh`) in the Vercel project. Every absolute URL is
built from it; a production build with no Vercel environment falls back to `https://helicon.sh`.

- Page content and the registry every surface reads: `src/lib/seo/content/*.ts`, `src/lib/seo/catalog.ts`
- Per page `<head>`, canonical and Open Graph: `src/lib/seo/metadata.ts`
- schema.org JSON-LD, one merged graph per page: `src/lib/seo/schema.ts`, `src/components/structured-data.tsx`
- Social images, one per page from `/api/og`: `src/lib/og-image.tsx`
- `robots.txt` (37 search and AI crawlers named explicitly), `sitemap.xml`, `manifest.webmanifest`:
  `src/app/robots.ts`, `sitemap.ts`, `manifest.ts`
- For AI agents and answer engines, all generated from the same data the pages render:
  - `/llms.txt`, `/llms-full.txt`, `/agents.md`, `/facts.json`, `/pricing.md`, `/faq.md`
  - `<any-page>.md`, or any page with `Accept: text/markdown` (`src/proxy.ts`)
  - Content lives in `src/lib/ai-docs.ts` and `src/lib/seo/markdown.ts`

```sh
npm run build && npx next start -p 3111
npm run seo:check      # canonicals, titles, descriptions, h1s, JSON-LD, og:image, .md mirrors
npm run seo:indexnow   # tell Bing, Yandex, Seznam and Naver that URLs changed
```

Verification tags are emitted only when their variable is set: `GOOGLE_SITE_VERIFICATION`,
`BING_SITE_VERIFICATION`, `YANDEX_VERIFICATION`, `NAVER_SITE_VERIFICATION`. Google Analytics 4
loads only when `NEXT_PUBLIC_GA_ID` is set.

## Installer downloads

`/download/windows` and `/download/macos` resolve the latest GitHub Release asset and 302 to it.

Optional env:

- **`NEXT_PUBLIC_POSTHOG_KEY`** / **`POSTHOG_KEY`** / **`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`** — Helicon-only PostHog project. Client SDK captures pageviews, autocapture, heatmaps, session replay, `download_click`, `github_click`, `demo_play`, `copy_command`, `install_os_tab`, `faq_toggle`. `/download/*` records `installer_download` (installer OS vs visitor OS, src, asset, version). No-op if unset. Not the desktop app.
- **`NEXT_PUBLIC_POSTHOG_HOST`** — defaults to `https://us.i.posthog.com`
- **`GITHUB_TOKEN`** — optional, raises GitHub API rate limits for latest-release lookups

## Recorded walkthrough

Hero video is `public/demo/a1.mp4` (muted, looping on desktop). GitHub README uses `docs/assets/demo.gif` because repository MP4s do not play inline.

## Live product demos

Below the recording, the app windows are the real Helicon UI, not screenshots:

- `src/product/` is a copy of `packages/ui/src`, and `src/app/product-theme.css` is generated from
  `apps/web/src/theme.css`. Refresh both after product UI changes: `node scripts/sync-product-ui.mjs`.
  Do not edit them by hand; the sync script applies the few landing-specific patches.
- `src/demo/client.ts` is an in-memory `HeliconClient` with sample projects, threads, usage and models.
  It plays turns back as MSP events, so sending a message or answering an approval works in the browser.
- `src/demo/demo-app.tsx` mounts the product shell with a real `HeliconController`, scales it to fit,
  and keeps overlays inside the demo window.

## Sources

- Type: Mona Sans (landing), Inter, Newsreader and JetBrains Mono (product faces for the demos).
- Icons: Phosphor everywhere: the landing page, the product demos (bold, set in the product's `ControllerProvider`) and the platform logos in `src/components/os-logos.tsx` (fill). The video play button keeps a hand-drawn triangle whose centroid, not its bounding box, is centred in the circle.
- Button styling adapted from shadcn/ui Button (MIT).
- `legacy/` keeps the previous static page for reference.
