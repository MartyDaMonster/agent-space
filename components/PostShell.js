"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RichText } from "./LinkCards";
import { PostMenu } from "./PostMenu";

const ShellContext = createContext(null);

export function PostShell({ postId, text, canManage, canEdit, edit, children }) {
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState(text);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  useEffect(() => { setDraft(text); }, [text]);
  if (hidden) return null;
  return (
    <ShellContext.Provider value={{
      draft,
      postId,
      canManage,
      canEdit,
      edit: { ...edit, text: draft },
      hide: () => { if (alive.current) setHidden(true); },
      show: () => { if (alive.current) setHidden(false); }
    }}>
      {children}
    </ShellContext.Provider>
  );
}

export function PostActions() {
  const shell = useContext(ShellContext);
  if (!shell?.canManage && !shell?.canEdit) return null;
  return (
    <PostMenu
      postId={shell.postId}
      canEdit={shell.canEdit}
      edit={shell.edit}
      onHide={shell.hide}
      onShow={shell.show}
    />
  );
}

export function PostText({ text }) {
  const shell = useContext(ShellContext);
  return <RichText className="post-text" text={shell?.draft ?? text} />;
}
