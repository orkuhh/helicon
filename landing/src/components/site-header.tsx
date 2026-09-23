import {
  BookOpen,
  DownloadSimple,
  Lightning,
  MonitorPlay,
  Question,
  SquaresFour,
  TerminalWindow,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { REPO_URL } from "@/lib/site";
import type { PageCopy } from "@/lib/copy";
import { GitHubLogo } from "./os-logos";
import { MobileNav } from "./mobile-nav";
import { SiteSearch } from "./seo/site-search";
import { ThemeToggle } from "./theme-toggle";
import { Logo, Rule, buttonClass } from "./ui";
import { TrackedLink } from "./tracked-link";

const links = [
  { href: "#demo", label: "Demo", icon: MonitorPlay },
  { href: "#features", label: "Features", icon: SquaresFour },
  { href: "#how", label: "How it works", icon: Lightning },
  { href: "#install", label: "Install", icon: TerminalWindow },
  { href: "#faq", label: "FAQ", icon: Question },
  // The only nav entry that leaves the page. An agent reading the home page has to be able to
  // find the documentation without guessing a path, and /docs redirects here.
  { href: "/guides", label: "Docs", icon: BookOpen },
];

/** Generated pages are not the home page, so their nav points at real paths rather than hashes. */
export const docLinks = [
  { href: "/features", label: "Features", icon: Lightning },
  { href: "/compare", label: "Compare", icon: MonitorPlay },
  { href: "/guides", label: "Guides", icon: Question },
  { href: "/install", label: "Install", icon: TerminalWindow },
];

export function SiteHeader({
  copy,
  nav = links,
  homeHref = "#top",
  cta,
}: {
  copy: PageCopy;
  nav?: { href: string; label: string; icon: typeof MonitorPlay }[];
  homeHref?: string;
  /**
   * Replaces the download button. Generated pages pass a client component, because they are
   * static and the default copy's button points at #install, an anchor that only the home page
   * has.
   */
  cta?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-[210] isolate bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-bg">
      <div className="relative flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-8 lg:px-12">
        <a
          href={homeHref}
          className="-mx-1 flex min-h-11 items-center gap-2 rounded-lg px-1 py-1 text-fg sm:-mx-1.5 sm:gap-2.5 sm:px-1.5"
          aria-label="Helicon home"
        >
          <Logo size={28} />
          <span className="hidden font-headline text-[18px] font-semibold min-[420px]:inline">Helicon</span>
        </a>

        <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 lg:flex max-xl:ml-2 max-xl:gap-0">
          {nav.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] font-medium whitespace-nowrap text-muted transition-colors hover:bg-sunken hover:text-fg max-xl:px-2.5"
            >
              <Icon aria-hidden="true" className="size-4 text-subtle max-xl:hidden" />
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <SiteSearch />
          <ThemeToggle className="max-sm:hidden" />
          <TrackedLink
            href={REPO_URL}
            placement="header"
            eventLabel="GitHub"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("ghost", "icon", "max-sm:hidden")}
            aria-label="Helicon on GitHub"
            title="Helicon on GitHub"
          >
            <GitHubLogo aria-hidden="true" />
          </TrackedLink>
          {cta ?? (
            <TrackedLink
              href={copy.headerHref}
              placement="header"
              eventLabel={copy.headerCta}
              className={buttonClass("primary", "sm", "ml-0 min-h-11 px-3 sm:ml-1.5 sm:min-h-0")}
            >
              <DownloadSimple weight="bold" aria-hidden="true" />
              {copy.headerCta}
            </TrackedLink>
          )}
          <MobileNav
            links={[
              ...nav.map(({ href, label }) => ({ href, label })),
              { href: REPO_URL, label: "GitHub" },
            ]}
          />
        </div>
      </div>
      <Rule />
    </header>
  );
}
