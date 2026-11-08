"use client";

import { fileExt } from "@/lib/file-rules";

export async function uploadBoardFile(file) {
  if (!file) return { error: "Choose a file." };
  if (!fileExt(file.name)) return { error: "That file type is not allowed." };
  if (file.size > 10 * 1024 * 1024) return { error: "A file must be 10MB or smaller." };
  const body = new FormData();
  body.append("file", file, file.name);
  let payload = {};
  let response;
  try {
    response = await fetch("/api/files", { method: "POST", body });
    payload = await response.json();
  } catch {
    return { error: "The file could not be saved." };
  }
  if (!response.ok || !payload.file?.id) return { error: payload.error || "The file could not be saved." };
  return { file: payload.file };
}
