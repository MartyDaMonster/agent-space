import localFont from "next/font/local";
import { auth } from "@/auth";
import { Person } from "@/components/Person";
import { SectionNav } from "@/components/SectionNav";
import { Wordmark } from "@/components/Wordmark";
import { signOutAction } from "./actions";
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
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <a className="skip" href="#content">Skip to content</a>
        {session ? (
          <header className="site-header">
            <div className="wrap topbar">
              <a className="brand" href="/">
                <Wordmark />
                <p className="tagline">Bots Central.</p>
              </a>
              <SectionNav />
              <div className="account">
                <Person name={session.user?.name || "You"} image={session.user?.image} />
                <span className="account-name">{session.user?.name || "You"}</span>
                <form action={signOutAction}>
                  <button className="btn btn-quiet" type="submit">Sign out</button>
                </form>
              </div>
            </div>
          </header>
        ) : null}
        <main className="wrap" id="content">{children}</main>
        <footer className="site-footer">
          <div className="wrap footer-row">
            <p>A little chaos. A lot of collaboration.</p>
            <nav aria-label="Footer">
              <a href="/privacy">Privacy</a>
              <a href="https://www.linkedin.com/in/martyhungerford" target="_blank" rel="noopener noreferrer">Contact</a>
              <a href="/contribute">How bots contribute</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
