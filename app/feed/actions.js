"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { emailAllowed } from "@/lib/access";
import { cleanComment, cleanEmoji, cleanPostText, inspectImage, inspectLink, inspectVideo, readPageTitle } from "@/lib/compose";
import { dismissOnboarding } from "@/lib/humans";
import { readFileIds } from "@/lib/file-rules";
import { attachToComment, attachToPost } from "@/lib/files";
import { canEditPost, canManageContent } from "@/lib/moderation";
import {
  deleteCommentNow,
  deletePostNow,
  destroyComment,
  destroyPost,
  findComment,
  findPost,
  insertComment,
  insertHumanPost,
  markCommentDeleted,
  markCommentRestored,
  markPostDeleted,
  markPostRestored,
  postExists,
  publicId,
  toggleReaction,
  updateEditedPost
} from "@/lib/posts";
import { prepareProject } from "@/lib/project-fields";
import { archiveProject, createProject, projectBySlug, touchProject } from "@/lib/projects";
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

export async function finishOnboarding(formData) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  await dismissOnboarding(person.email);
  const next = String(formData?.get?.("next") || "/");
  revalidatePath("/");
  redirect(next === "/admin" ? "/admin" : "/");
}

export async function continueToFeed() {
  return finishOnboarding();
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
  const image = inspectImage(formData.get("image"));
  if (!image.ok) return { error: image.error };
  const video = inspectVideo(formData.get("video"));
  if (!video.ok) return { error: video.error };
  let media = null;
  let type = "message";
  if (!image.empty) {
    const classified = classifyMedia({ kind: "image", url: image.url, alt: text.text.slice(0, 200) });
    if (!classified.ok) return { error: classified.reason };
    const { ok, ...rest } = classified;
    media = rest;
    type = "media";
  } else if (!video.empty) {
    const classified = classifyMedia({ kind: video.kind, url: video.url, alt: video.alt });
    if (!classified.ok) return { error: classified.reason };
    const { ok, ...rest } = classified;
    media = rest;
    type = "media";
  }
  let linkTitle = "";
  if (!link.empty) linkTitle = (await readPageTitle(link.url)) || link.domain;
  const requested = String(formData.get("projectSlug") || "");
  let projectId = null;
  let projectSlug = "";
  if (requested) {
    const project = await projectBySlug(requested);
    if (!project || project.archived) return { error: "That project is archived." };
    projectId = project.id;
    projectSlug = project.slug;
  }
  const files = readFileIds(formData.getAll?.("fileId"));
  if (!files.ok) return { error: files.error };
  const postId = publicId("note");
  try {
    await insertHumanPost({
      id: postId,
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
      linkDomain: link.empty ? "" : link.domain,
      projectId
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "post failed");
    return { error: "The post could not be saved." };
  }
  if (files.ids.length) {
    const linked = await attachToPost(postId, files.ids, { kind: "human", id: person.email.trim().toLowerCase() });
    if (!linked.ok) {
      await deletePostNow(postId);
      return { error: linked.error };
    }
  }
  revalidatePath("/");
  if (projectSlug) revalidatePath(`/p/${projectSlug}`);
  return { saved: true };
}

export async function startProject(_previous, formData) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const prepared = prepareProject({
    name: formData.get("name"),
    description: formData.get("description"),
    emoji: formData.get("emoji"),
    color: formData.get("color")
  });
  if (!prepared.ok) return { error: prepared.error };
  const created = await createProject({
    prepared,
    email: person.email,
    postId: String(formData.get("postId") || "")
  });
  if (!created.ok) return { error: created.error };
  revalidatePath("/");
  redirect(`/p/${created.slug}`);
}

export async function closeProject(formData) {
  const person = await human();
  if (!person) return;
  const slug = String(formData.get("slug") || "");
  await archiveProject(slug, person.email);
  revalidatePath("/");
  revalidatePath(`/p/${slug}`);
  redirect("/");
}

export async function publishComment(_previous, formData) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const postId = String(formData.get("postId") || "");
  const text = cleanComment(formData.get("text"));
  if (!text.ok) return { error: text.error };
  if (!(await postExists(postId))) return { error: "That post is gone." };
  const files = readFileIds(formData.getAll?.("fileId"));
  if (!files.ok) return { error: files.error };
  const commentId = publicId("cmt");
  await insertComment({
    id: commentId,
    postId,
    authorKind: "human",
    authorEmail: person.email,
    authorName: person.name,
    authorImage: person.image,
    text: text.text,
    createdAt: utcStamp()
  });
  if (files.ids.length) {
    const linked = await attachToComment(commentId, files.ids, { kind: "human", id: person.email.trim().toLowerCase() });
    if (!linked.ok) {
      await deleteCommentNow(commentId);
      return { error: linked.error };
    }
  }
  revalidatePath("/");
  revalidatePath("/p", "layout");
  return { saved: true };
}

function manages(person, authorEmail) {
  return canManageContent({
    actorEmail: person.email,
    authorEmail,
    allowlist: process.env.ALLOWED_EMAILS
  });
}

export async function retirePost(postId) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const post = await findPost(String(postId || ""));
  if (!post || post.deleted_at) return { error: "That post is gone." };
  if (!manages(person, post.author_email)) return { error: "You can't delete that post." };
  await markPostDeleted(post.id);
  return { ok: true };
}

export async function restorePost(postId) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const post = await findPost(String(postId || ""));
  if (!post) return { error: "That post is gone." };
  if (!manages(person, post.author_email)) return { error: "You can't restore that post." };
  await markPostRestored(post.id);
  revalidatePath("/");
  revalidatePath("/p", "layout");
  return { ok: true };
}

export async function purgePost(postId) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const post = await findPost(String(postId || ""));
  if (!post) return { ok: true };
  if (!manages(person, post.author_email)) return { error: "You can't delete that post." };
  await destroyPost(post.id);
  revalidatePath("/");
  revalidatePath("/p", "layout");
  return { ok: true };
}

export async function saveEdit(_previous, formData) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const post = await findPost(String(formData.get("postId") || ""));
  if (!post || post.deleted_at) return { error: "That post is gone." };
  if (!canEditPost({
    actorEmail: person.email,
    authorEmail: post.author_email,
    authorKind: post.author_kind
  })) return { error: "You can only edit your own posts." };
  const text = cleanPostText(formData.get("text"));
  if (!text.ok) return { error: text.error };
  const link = inspectLink(formData.get("link"));
  if (!link.ok) return { error: link.error };
  const image = inspectImage(formData.get("image"));
  if (!image.ok) return { error: image.error };
  const video = inspectVideo(formData.get("video"));
  if (!video.ok) return { error: video.error };
  let media = null;
  let type = "message";
  if (!image.empty) {
    const classified = classifyMedia({ kind: "image", url: image.url, alt: text.text.slice(0, 200) });
    if (!classified.ok) return { error: classified.reason };
    const { ok, ...rest } = classified;
    media = rest;
    type = "media";
  } else if (!video.empty) {
    const classified = classifyMedia({ kind: video.kind, url: video.url, alt: video.alt });
    if (!classified.ok) return { error: classified.reason };
    const { ok, ...rest } = classified;
    media = rest;
    type = "media";
  }
  let linkTitle = "";
  if (!link.empty && !media) linkTitle = (await readPageTitle(link.url)) || link.domain;
  const requested = String(formData.get("projectSlug") || "");
  let projectId = null;
  if (requested) {
    const project = await projectBySlug(requested);
    if (!project) return { error: "That project is not open." };
    if (project.archived && project.id !== post.project_id) return { error: "That project is archived." };
    projectId = project.id;
  }
  const files = readFileIds(formData.getAll?.("fileId"));
  if (!files.ok) return { error: files.error };
  const saved = await updateEditedPost({
    id: post.id,
    email: person.email,
    text: text.text,
    type,
    media,
    linkUrl: link.empty || media ? "" : link.url,
    linkTitle: link.empty || media ? "" : linkTitle,
    linkDomain: link.empty || media ? "" : link.domain,
    projectId
  });
  if (!saved) return { error: "You can only edit your own posts." };
  const linked = await attachToPost(post.id, files.ids, { kind: "human", id: person.email.trim().toLowerCase() });
  if (!linked.ok) {
    revalidatePath("/");
    revalidatePath("/p", "layout");
    return { error: linked.error };
  }
  if (projectId) await touchProject(projectId);
  revalidatePath("/");
  revalidatePath("/p", "layout");
  return { saved: true };
}

export async function retireComment(commentId) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const comment = await findComment(String(commentId || ""));
  if (!comment || comment.deleted_at) return { error: "That comment is gone." };
  if (!manages(person, comment.author_email)) return { error: "You can't delete that comment." };
  await markCommentDeleted(comment.id);
  return { ok: true };
}

export async function restoreComment(commentId) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const comment = await findComment(String(commentId || ""));
  if (!comment) return { error: "That comment is gone." };
  if (!manages(person, comment.author_email)) return { error: "You can't restore that comment." };
  await markCommentRestored(comment.id);
  revalidatePath("/");
  revalidatePath("/p", "layout");
  return { ok: true };
}

export async function purgeComment(commentId) {
  const person = await human();
  if (!person) return { error: "You need to be signed in." };
  const comment = await findComment(String(commentId || ""));
  if (!comment) return { ok: true };
  if (!manages(person, comment.author_email)) return { error: "You can't delete that comment." };
  await destroyComment(comment.id);
  revalidatePath("/");
  revalidatePath("/p", "layout");
  return { ok: true };
}

export async function publishReaction(formData) {
  const person = await human();
  if (!person) return;
  const postId = String(formData.get("postId") || "");
  const emoji = cleanEmoji(String(formData.get("emoji") || ""));
  if (!emoji.ok || !(await postExists(postId))) return;
  await toggleReaction({ postId, actor: `human:${person.email}`, emoji: emoji.emoji });
  revalidatePath("/");
  revalidatePath("/p", "layout");
}
