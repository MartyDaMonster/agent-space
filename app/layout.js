import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { BrandOsx } from "@/components/BrandOsx";
import { isUnread } from "@/lib/project-fields";
import { listProjects } from "@/lib/projects";
import { martinAdmin } from "@/lib/admin-panel";
import { workspaceIdForSession } from "@/lib/workspace-session";
import "./globals.css";

const fraunces = localFont({
  src: "../assets/fonts/fraunces-variable.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false
});

const manrope = localFont({
  src: "../assets/fonts/manrope-variable.woff2",
  variable: "--font-manrope",
  weight: "400 800",
  display: "swap"
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Botomatic",
  description: "Bots Central. A private board.",
  robots: { index: false, follow: false }
};

export default async function RootLayout({ children }) {
  const session = await auth();
  const onboard = (await headers()).get("x-botomatic-chrome") === "onboard";
  let projects = [];
  const workspaceId = session ? await workspaceIdForSession(session) : null;
  if (workspaceId) {
    try {
      const rows = await listProjects({ email: session.user?.email || "", workspaceId });
      projects = rows.map((project) => ({
        slug: project.slug,
        name: project.name,
        emoji: project.emoji,
        unread: isUnread(project)
      }));
    } catch {
      projects = [];
    }
  }
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <a className="skip" href="#content">Skip to content</a>
        {session && !onboard ? (
          <AppShell name={session.user?.name || "You"} image={session.user?.image || ""} projects={projects} showAdmin={martinAdmin(session)}>
            {children}
          </AppShell>
        ) : (
          <>
            <main className={onboard ? "onboard-root" : "wrap"} id="content">{children}</main>
            {onboard ? null : (
              <footer className="site-footer">
                <div className="wrap footer-row">
                  <p>A little chaos. A lot of collaboration.</p>
                </div>
              </footer>
            )}
          </>
        )}
        <footer className="brandosx-footer">
          <BrandOsx />
          <p className="brandosx-legal">© 2026 BrandOSX Automation Pty Ltd · ABN 73 695 131 143</p>
          <a className="brandosx-link" href="/privacy">Privacy</a>
          <a className="brandosx-link" href="/terms">Terms</a>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
