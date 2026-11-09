"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { QUOTA_MESSAGE, acceptsExtensionList, usageLabel } from "@/lib/file-rules";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function FileList({ files = [], onChange }) {
  if (!files.length) return null;
  return (
    <ul className="file-list">
      {files.map((file) => (
        <FileCard key={file.id} file={file} onChange={onChange} />
      ))}
    </ul>
  );
}

function FileCard({ file, onChange }) {
  const [preview, setPreview] = useState("");
  const [gone, setGone] = useState(file.expired);
  if (gone || file.expired) return <li className="file-expired">File expired</li>;
  const image = ["png", "jpg", "jpeg", "webp", "gif"].includes(file.extension);
  async function remove() {
    const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    if (response.ok) {
      setGone(true);
      onChange?.(file.id);
    }
  }
  async function openPreview() {
    if (preview || file.extension !== "md") return;
    const response = await fetch(`/api/files/${file.id}`);
    if (response.ok) setPreview(await response.text());
  }
  return (
    <li className="file-card">
      <span className="file-type">{file.extension}</span>
      <span className="file-name">
        <strong>{file.name}</strong>
        <span>{formatSize(file.bytes)}</span>
      </span>
      <span className="file-actions">
        <a href={`/api/files/${file.id}?download=1`}>Download</a>
        {file.canDelete ? (
          <button type="button" className="text-btn" aria-label={`Delete ${file.name}`} onClick={remove}>Delete</button>
        ) : null}
      </span>
      {image ? <img className="file-inline" src={`/api/files/${file.id}`} alt={file.name} /> : null}
      {file.extension === "md" ? (
        <details className="file-preview" onToggle={(event) => { if (event.currentTarget.open) openPreview(); }}>
          <summary>Preview</summary>
          <pre>{preview}</pre>
        </details>
      ) : null}
    </li>
  );
}

export const AttachFiles = forwardRef(function AttachFiles(_props, ref) {
  const [files, setFiles] = useState([]);
  const [usage, setUsage] = useState(null);
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/files")
      .then((response) => response.ok ? response.json() : null)
      .then((body) => { if (live && body?.usage) setUsage(body.usage); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  async function add(list) {
    const incoming = [...(list || [])];
    for (const file of incoming) {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/files", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "That file could not be uploaded.");
        if (response.status === 413) setFull(true);
        return;
      }
      setFiles((current) => [...current, payload.file]);
      if (payload.usage) setUsage(payload.usage);
      setError("");
      setFull(false);
    }
  }

  useImperativeHandle(ref, () => ({ add }), []);

  const packed = usage && usage.bytes >= usage.quota;
  return (
    <div className="attach-block">
      <div className="attach-row">
        <label className="text-btn attach-label">
          Attach
          <input
            type="file"
            multiple
            accept={acceptsExtensionList()}
            onChange={(event) => {
              add(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {usage ? <p className="usage-line">{usageLabel(usage.bytes)}</p> : null}
      </div>
      {full || packed ? <p className="warning">{QUOTA_MESSAGE}</p> : null}
      {error && error !== QUOTA_MESSAGE ? <p className="warning">{error}</p> : null}
      {files.map((file) => <input key={file.id} type="hidden" name="fileId" value={file.id} />)}
      <FileList files={files.map((file) => ({ ...file, canDelete: true }))} onChange={(id) => {
        setFiles((current) => current.filter((file) => file.id !== id));
      }} />
    </div>
  );
});
