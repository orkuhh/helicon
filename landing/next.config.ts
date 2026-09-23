import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One canonical host: www.helicon.sh permanently redirects to helicon.sh.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.helicon.sh" }],
        destination: "https://helicon.sh/:path*",
        permanent: true,
      },
      // Terms people type into the address bar or link to from elsewhere, sent to the page that
      // actually answers them rather than to a 404.
      { source: "/gui", destination: "/muse-code-gui", permanent: true },
      { source: "/desktop", destination: "/muse-code-desktop-app", permanent: true },
      { source: "/app", destination: "/muse-code-desktop-app", permanent: true },
      { source: "/windows", destination: "/install/windows", permanent: true },
      { source: "/mac", destination: "/install/macos", permanent: true },
      { source: "/macos", destination: "/install/macos", permanent: true },
      { source: "/linux", destination: "/install/linux", permanent: true },
      { source: "/wsl", destination: "/install/wsl2", permanent: true },
      { source: "/docs", destination: "/guides", permanent: true },
      // The paths people and crawlers try when looking for an API. Each lands on the real thing.
      { source: "/api-docs", destination: "/developers", permanent: true },
      { source: "/developer", destination: "/developers", permanent: true },
      { source: "/openapi", destination: "/openapi.json", permanent: true },
      { source: "/openapi.yaml", destination: "/api/openapi.yaml", permanent: true },
      { source: "/swagger.json", destination: "/openapi.json", permanent: true },
      { source: "/alternatives", destination: "/compare", permanent: true },
      { source: "/vs/:slug", destination: "/compare/:slug", permanent: true },
      { source: "/releases", destination: "/changelog", permanent: true },
      { source: "/feed.xml", destination: "/atom.xml", permanent: true },
      { source: "/feed", destination: "/atom.xml", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // The machine-readable surfaces are meant to be fetched by tools on other origins.
        source: "/:path(llms.txt|llms-full.txt|agents.md|facts.json|openapi.json|sitemap.xml|rss.xml|atom.xml|search-index.json)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Robots-Tag", value: "index, follow" },
        ],
      },
      {
        source: "/md/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Robots-Tag", value: "index, follow" },
        ],
      },
      {
        // The public JSON API. Read only and anonymous, so anyone may call it from anywhere.
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Accept, Content-Type" },
        ],
      },
      {
        source: "/api/openapi.yaml",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Robots-Tag", value: "index, follow" },
        ],
      },
      {
        // Every page answers in HTML or in Markdown depending on Accept, so anything caching a
        // response has to key on it. This covers the route handlers and the generated documents.
        // Page responses keep the Vary that Next writes for its own router, which overwrites this
        // one: they are safe because proxy.ts rewrites a Markdown request to /md/<path> before the
        // cache is consulted, so the two representations never share a cache key. Static assets
        // are excluded because they have one representation and nothing to negotiate.
        source: "/((?!_next/).*)",
        headers: [{ key: "Vary", value: "Accept" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
