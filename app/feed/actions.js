"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { emailAllowed } from "@/lib/access";
import { cleanComment, cleanEmoji, cleanPostText, inspectLink, inspectVideo, readPageTitle } from "@/lib/compose";
import { dismissOnboarding } from "@/lib/humans";
import { insertComment, insertHumanPost, postExists, publicId, toggleReaction } from "@/lib/posts";
import { classifyMedia } from "@/scripts/media.js";
import { utcStamp } from "@/scripts/schema.js";

async function human() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!emailAllowed(email, process.env.ALLOWED_EMAILS)) return null;
  return {
    email,
    name: session.user.name || email,
    image: typeof session.user.image === "string" && session.user.image.startsWith("https://") ? session.user.image : ""
  };
}

export async function continueToFeed() {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  await dismissOnboarding(person.email);
  revalidatePath("/");
  return { ok: true };
}

export async function previewLink(url) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const link = inspectLink(url);
  if (!link.ok) return { error: link.error };
  if (link.empty) return { empty: true };
  const title = await readPageTitle(link.url);
  return { url: link.url, domain: link.domain, title: title || link.domain };
}

export async function publishPost(_previous, formData) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const text = cleanPostText(formData.get("text"));
  if (!text.ok) return { error: text.error };
  const link = inspectLink(formData.get("link"));
  if (!link.ok) return { error: link.error };
  const video = inspectVideo(formData.get("video"));
  if (!video.ok) return { error: video.error };
  let media = null;
  let type = "message";
  if (!video.empty) {
    const classified = classifyMedia({ kind: video.kind, url: video.url, alt: video.alt });
    if (!classified.ok) return { error: classified.reason };
    const { ok, ...rest } = classified;
    media = rest;
    type = "media";
  }
  let linkTitle = "";
  if (!link.empty) linkTitle = (await readPageTitle(link.url)) || link.domain;
  try {
    await insertHumanPost({
      id: publicId("note"),
      type,
      from: "human",
      text: text.text,
      createdAt: utcStamp(),
      media,
      authorName: person.name,
      authorEmail: person.email,
      authorImage: person.image,
      linkUrl: link.empty ? "" : link.url,
      linkTitle,
      linkDomain: link.empty ? "" : link.domain
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "post failed");
    return { error: "The post could not be saved." };
  }
  revalidatePath("/");
  return { saved: true };
}

export async function publishComment(_previous, formData) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const postId = String(formData.get("postId") || "");
  const text = cleanComment(formData.get("text"));
  if (!text.ok) return { error: text.error };
  if (!(await postExists(postId))) return { error: "That post is gone." };
  await insertComment({
    id: publicId("cmt"),
    postId,
    authorKind: "human",
    authorEmail: person.email,
    authorName: person.name,
    authorImage: person.image,
    text: text.text,
    createdAt: utcStamp()
  });
  revalidatePath("/");
  return { saved: true };
}

export async function publishReaction(formData) {
  const person = await human();
  if (!person) return;
  const postId = String(formData.get("postId") || "");
  const emoji = cleanEmoji(String(formData.get("emoji") || ""));
  if (!emoji.ok || !(await postExists(postId))) return;
  await toggleReaction({ postId, actor: `human:${person.email}`, emoji: emoji.emoji });
  revalidatePath("/");
}
