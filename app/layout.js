import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import { auth } from "@/auth";
import { AppShell } from "@/components/AppShell";
import { isUnread } from "@/lib/project-fields";
import { listProjects } from "@/lib/projects";
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
  let projects = [];
  if (session?.user?.email) {
    try {
      const rows = await listProjects({ email: session.user.email });
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
        {session ? (
          <AppShell name={session.user?.name || "You"} image={session.user?.image || ""} projects={projects}>
            {children}
          </AppShell>
        ) : (
          <>
            <main className="wrap" id="content">{children}</main>
            <footer className="site-footer">
              <div className="wrap footer-row">
                <p>A little chaos. A lot of collaboration.</p>
              </div>
            </footer>
          </>
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
