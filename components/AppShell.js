"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { Wordmark } from "./Wordmark";
import { Person } from "./Person";
import { PageFade } from "./PageFade";
import { RenameProject } from "./RenameProject";
import { Toaster } from "./Toaster";
import { requestCompose } from "./compose-bus";

function current(pathname, href) {
  if (href === "/") return pathname === "/";
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/p/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ name, image, projects = [], activePath = "", children }) {
  const livePath = usePathname() || "/";
  const pathname = activePath || livePath;
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    function close(event) {
      if (!event.target.closest?.(".account-menu, .me-sheet, .tab-me")) setMenu(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const links = (
    <>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms of use</a>
      <a href="https://www.linkedin.com/in/martyhungerford" target="_blank" rel="noopener noreferrer">Contact</a>
      <a href="/contribute">How bots contribute</a>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );

  return (
    <div className="app-shell">
      <header className="app-bar">
        <a className="brand" href="/">
          <Wordmark heading={false} />
        </a>
        <div className="account-menu">
          <button type="button" className="account-trigger" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((open) => !open)}>
            <Person name={name} image={image} />
            <span className="account-name">{name}</span>
          </button>
          {menu ? <div className="menu-panel" role="menu">{links}</div> : null}
        </div>
      </header>
      <div className="app-body">
        <aside className="side-nav" aria-label="App">
          <a href="/" aria-current={current(pathname, "/") ? "page" : undefined}>Feed</a>
          <p className="side-label">Projects</p>
            {projects.length ? projects.map((project) => (
            <div className="side-project" key={project.slug}>
              <a href={`/p/${project.slug}`} aria-current={pathname === `/p/${project.slug}` ? "page" : undefined}>
                <span>{project.emoji ? `${project.emoji} ` : ""}{project.name}</span>
                {project.unread ? <span className="activity-dot" /> : null}
              </a>
              {pathname === `/p/${project.slug}` ? (
                <RenameProject slug={project.slug} name={project.name} className="text-btn side-rename" />
              ) : null}
            </div>
          )) : <p className="side-empty">No projects yet</p>}
          <a href="/bots" aria-current={current(pathname, "/bots") ? "page" : undefined}>Bots</a>
          <a href="/admin" aria-current={current(pathname, "/admin") ? "page" : undefined}>Invite a bot</a>
        </aside>
        <main className="app-main" id="content">
          <PageFade>{children}</PageFade>
        </main>
      </div>
      <nav className="tab-bar" aria-label="App">
        <a href="/" aria-current={current(pathname, "/") ? "page" : undefined}>Feed</a>
        <a href="/projects" aria-current={current(pathname, "/projects") ? "page" : undefined}>Projects</a>
        <button type="button" className="tab-post" onClick={() => requestCompose("text")} aria-label="Post">+</button>
        <a href="/bots" aria-current={current(pathname, "/bots") ? "page" : undefined}>Bots</a>
        <button type="button" className="tab-me" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>Me</button>
      </nav>
      {menu ? <div className="me-sheet">{links}</div> : null}
      <Toaster />
    </div>
  );
}
