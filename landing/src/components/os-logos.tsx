// Platform and GitHub marks, from Phosphor (MIT, phosphoricons.com) like every other icon on the site
// and in the product (#16). The fill weight, so they read as solid brand marks next to the outlined
// UI icons. The names and props are unchanged, so callers pass size and className as before.
import type { IconProps } from "@phosphor-icons/react";
import { AppleLogoIcon, GithubLogoIcon, LinuxLogoIcon, WindowsLogoIcon } from "@phosphor-icons/react/ssr";

type LogoProps = Omit<IconProps, "weight">;

/** Decorative by default, like the hand-drawn marks these replace; pass aria-hidden={false} with a label to announce one. */
const mark = (props: LogoProps): IconProps => ({
  size: "1em",
  "aria-hidden": true,
  focusable: false,
  ...props,
  weight: "fill",
});

export function WindowsLogo(props: LogoProps) {
  return <WindowsLogoIcon {...mark(props)} />;
}

export function AppleLogo(props: LogoProps) {
  return <AppleLogoIcon {...mark(props)} />;
}

export function GitHubLogo(props: LogoProps) {
  return <GithubLogoIcon {...mark(props)} />;
}

export function LinuxLogo(props: LogoProps) {
  return <LinuxLogoIcon {...mark(props)} />;
}
