"use client";

import { useState } from "react";
import { fileExt, fileHref, formatSize } from "@/lib/file-rules";

function blocks(source) {
  const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = null;
  let code = null;
  function flushParagraph() {
    if (!paragraph.length) return;
    out.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  }
  function flushList() {
    if (!list) return;
    out.push(list);
    list = null;
  }
  for (const line of lines) {
    if (code) {
      if (line.startsWith("```")) {
        out.push(code);
        code = null;
      } else code.text += `${line}\n`;
      continue;
    }
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      code = { type: "code", text: "" };
      continue;
    }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      out.push({ type: "h", level: heading[1].length, text: heading[2] });
      continue;
    }
    const item = /^[-*] (.+)$/.exec(line);
    if (item) {
      flushParagraph();
      list = list || { type: "ul", items: [] };
      list.items.push(item[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  if (code) out.push(code);
  flushParagraph();
  flushList();
  return out;
}

function inline(text, keyPrefix) {
  const parts = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;
  let last = 0;
  let index = 0;
  for (const match of String(text).matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith("`")) parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("**")) parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    else {
      const link = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/.exec(token);
      parts.push(<a key={key} href={link[2]} rel="noopener noreferrer">{link[1]}</a>);
    }
    last = match.index + token.length;
    index += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ source }) {
  return (
    <div className="md-body">
      {blocks(source).map((block, index) => {
        if (block.type === "h") return <p className="md-heading" key={index}>{inline(block.text, index)}</p>;
        if (block.type === "ul") {
          return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `${index}-${itemIndex}`)}</li>)}</ul>;
        }
        if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
        return <p key={index}>{inline(block.text, index)}</p>;
      })}
    </div>
  );
}

function MarkdownFile({ file }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const href = fileHref(file.id);
  async function load(event) {
    if (!event.currentTarget.open || text || !href) return;
    try {
      const response = await fetch(href);
      if (!response.ok) {
        setError("The preview could not be opened.");
        return;
      }
      setText(await response.text());
    } catch {
      setError("The preview could not be opened.");
    }
  }
  return (
    <details className="file-md" onToggle={load}>
      <summary>Preview</summary>
      {error ? <p className="warning">{error}</p> : text ? <Markdown source={text} /> : <p className="meta">Opening…</p>}
    </details>
  );
}

export function FileCards({ files = [], onRemove }) {
  if (!files.length) return null;
  return (
    <ul className="file-list">
      {files.map((file) => {
        const href = fileHref(file.id);
        const ext = fileExt(file.name);
        if (!href) return null;
        return (
          <li className="file-card" key={file.id}>
            <span className="file-icon" aria-hidden="true">{ext || "file"}</span>
            <span className="file-copy">
              <strong>{file.name}</strong>
              <span>{formatSize(file.size)}</span>
            </span>
            <span className="file-actions">
              <a href={href}>Download</a>
              {onRemove ? <button className="text-btn" type="button" onClick={() => onRemove(file.id)}>Remove</button> : null}
            </span>
            {ext === "md" ? <MarkdownFile file={file} /> : null}
            {String(file.contentType || "").startsWith("image/") ? (
              <img src={href} alt={file.name} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
