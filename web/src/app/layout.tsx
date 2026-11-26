import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Footer } from "@/components/footer";
import { MarketingHeader } from "@/components/header";
import { MenuAutoClose } from "@/components/motion/menu-autoclose";
import { NavPending } from "@/components/motion/nav-pending";
import { RouteFallback } from "@/components/motion/route-fallback";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { CheckWatch } from "@/components/check-watch";
import { appShell } from "@/components/shell/app-shell";
import { CheckLinks } from "@/components/shell/check-focus";
import { ShellFrame } from "@/components/shell/shell-frame";
import { themeScript } from "@/components/theme-toggle";
import { ANALYTICS } from "@/lib/analytics";
import { motionAttr, motionFromCookies } from "@/lib/motion";
import { currentUser } from "@/lib/session";
import { RAIL_COOKIE, railCollapsed } from "@/lib/shell";
import { SITE_URL } from "@/lib/site";
import "lenis/dist/lenis.css";
import "./globals.css";

// Harbor's type: Geist for reading and the interface, Bricolage Grotesque
// for headings and the wordmark, Geist Mono for code, URLs and figures.
const sans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});
const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PRScout · will this repo merge your PR?",
    template: "%s · PRScout",
  },
  description:
    "Paste any GitHub repo. PRScout reads its recent pull requests and tells you, in plain English, whether outside contributors get replies, get merged, and where their work lands.",
  openGraph: {
    siteName: "PRScout",
    type: "website",
    title: "PRScout · check whether a repo actually merges outsiders' PRs",
    description:
      "See how a project treats outside contributors before you spend your week on it. Swap hub for PRScout in any GitHub link.",
  },
  twitter: { card: "summary_large_image" },
  // Staging and previews: keep search engines out (robots.txt disallows too).
  ...(process.env.ROBOTS_NOINDEX === "1"
    ? { robots: { index: false, follow: false } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1115" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Signed in: the app shell's sidebar and top bar, used on app pages (lib/shell.ts).
  const jar = await cookies();
  const user = await currentUser();
  // The desktop rail folded or not, on <html> before the first paint (lib/shell.ts).
  const rail = railCollapsed(jar.get(RAIL_COOKIE)?.value);
  const app = user ? await appShell(user, rail) : null;
  // The motion setting, on <html> before the first paint (lib/motion.ts).
  const motion = motionAttr(motionFromCookies(jar));
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
      data-motion={motion}
      data-rail={rail ? "collapsed" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {ANALYTICS && (
          <script
            defer
            src={ANALYTICS.src}
            data-website-id={ANALYTICS.websiteId}
          />
        )}
      </head>
      {/* Extensions such as Grammarly add attributes to <body> before React
          hydrates. This only silences attribute mismatches on <body> itself. */}
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <ShellFrame
          marketingHeader={<MarketingHeader user={user} />}
          footer={<Footer signedIn={Boolean(user)} />}
          topBar={app?.topBar ?? null}
          rail={app?.rail ?? null}
        >
          {children}
          <RouteFallback />
        </ShellFrame>
        {user && <CheckWatch />}
        <NavPending />
        <MenuAutoClose />
        <CheckLinks />
        <SmoothScroll />
      </body>
    </html>
  );
}
