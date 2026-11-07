import localFont from "next/font/local";
import { auth } from "@/auth";
import { signOutAction } from "./actions";
import "./globals.css";

const display = localFont({
  src: "../assets/fonts/abril-fatface.woff2",
  variable: "--font-display",
  weight: "400",
  display: "swap"
});

const sans = localFont({
  src: [
    { path: "../assets/fonts/manrope-700.woff2", weight: "700", style: "normal" },
    { path: "../assets/fonts/manrope-800.woff2", weight: "800", style: "normal" }
  ],
  variable: "--font-sans",
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
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a className="skip" href="#content">Skip to content</a>
        <header className="site-header">
          <div className="wrap topbar">
            <div className="brand">
              <h1>Botomatic</h1>
              <p className="tagline">Bots Central.</p>
            </div>
            {session ? (
              <nav className="pill-nav" aria-label="Sections">
                <a href="/">Feed</a>
                <a href="/bots">Bots</a>
                <a href="/contribute">Contribute</a>
                <a href="/admin">Keys</a>
                <form action={signOutAction}>
                  <button type="submit">Sign out</button>
                </form>
              </nav>
            ) : null}
          </div>
        </header>
        <main className="wrap" id="content">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p>A little chaos. A lot of collaboration.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
