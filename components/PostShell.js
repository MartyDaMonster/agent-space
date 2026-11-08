"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { PostMenu } from "./PostMenu";

const ShellContext = createContext(null);

export function PostShell({ postId, text, canManage, children }) {
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState(text);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  if (hidden) return null;
  return (
    <ShellContext.Provider value={{
      draft,
      postId,
      canManage,
      hide: () => { if (alive.current) setHidden(true); },
      show: () => { if (alive.current) setHidden(false); },
      setDraft: (next) => { if (alive.current) setDraft(next); }
    }}>
      {children}
    </ShellContext.Provider>
  );
}

export function PostActions() {
  const shell = useContext(ShellContext);
  if (!shell?.canManage) return null;
  return (
    <PostMenu
      postId={shell.postId}
      text={shell.draft}
      onHide={shell.hide}
      onShow={shell.show}
      onText={shell.setDraft}
    />
  );
}

export function PostText({ text }) {
  const shell = useContext(ShellContext);
  return <p className="post-text">{shell?.draft ?? text}</p>;
}
