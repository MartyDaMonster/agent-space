"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cleanComment, cleanEmoji, cleanPostText } from "@/lib/compose";
import { REACTION_EMOJI } from "@/lib/compose";
import { boardAccess, workspaceIdForSession, workspaceRole } from "@/lib/workspace-session";
import { spaceAccess, spaceWritesOpen } from "@/lib/space-access";
import {
  acceptSpaceInvite,
  archiveSpace,
  createSpace,
  createSpaceInvite,
  removeSpaceBot,
  removeSpaceWorkspace,
  renameSpace,
  revokeSpaceInvite,
  setSpaceBots,
  setSpacePostHidden,
  viewerFromSession
} from "@/lib/spaces";
import { addSpaceHumanPost, addSpaceReaction, findSpacePost } from "@/lib/space-feed";
import { deletePostNow } from "@/lib/posts";
import { publicId } from "@/lib/posts";
import { insertComment } from "@/lib/posts";
import { prepareSpaceWrite } from "@/lib/space-feed";
import { utcStamp } from "@/scripts/schema.js";

async function person() {
  const session = await auth();
  if ((await boardAccess(session)) !== "ok") return null;
  const workspaceId = await workspaceIdForSession(session);
  if (!workspaceId) return null;
  const role = await workspaceRole(session, workspaceId);
  if (role !== "owner" && role !== "member") return null;
  const email = String(session.user?.email || "").trim().toLowerCase();
  if (!email) return null;
  return {
    session,
    workspaceId,
    role,
    email,
    name: session.user?.name || email
  };
}

function viewer(actor) {
  return viewerFromSession(actor.session, actor.workspaceId, actor.role);
}

export async function createSpaceAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const created = await createSpace({
    workspaceId: actor.workspaceId,
    email: actor.email,
    role: actor.role,
    name: formData.get("name")
  });
  if (!created.ok) return { error: created.error || "That space could not be created." };
  revalidatePath("/");
  redirect(`/s/${created.space.slug}`);
}

export async function renameSpaceAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  const renamed = await renameSpace({ access, email: actor.email, name: formData.get("name") });
  if (!renamed.ok) return { error: renamed.error || "That space could not be renamed." };
  revalidatePath(`/s/${access.space.slug}`);
  return { ok: true };
}

export async function archiveSpaceAction(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  await archiveSpace({ access, session: actor.session, email: actor.email });
  if (access?.ok) revalidatePath(`/s/${access.space.slug}`);
}

export async function inviteSpaceAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  const invited = await createSpaceInvite({ access, session: actor.session, email: actor.email });
  if (!invited.ok) return { error: invited.error || "That invite could not be created." };
  revalidatePath(`/s/${access.space.slug}`);
  return { path: invited.path };
}

export async function revokeSpaceInviteAction(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  await revokeSpaceInvite({
    access,
    session: actor.session,
    email: actor.email,
    inviteId: String(formData.get("inviteId") || "")
  });
  if (access?.ok) revalidatePath(`/s/${access.space.slug}`);
}

export async function saveSpaceBotsAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  const slugs = formData.getAll("bot").map((value) => String(value));
  const saved = await setSpaceBots({ access, email: actor.email, slugs });
  if (!saved.ok) return { error: saved.error || "Those bots could not be saved." };
  revalidatePath(`/s/${access.space.slug}`);
  return { ok: true };
}

export async function removeWorkspaceAction(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  await removeSpaceWorkspace({
    access,
    session: actor.session,
    email: actor.email,
    workspaceId: String(formData.get("workspaceId") || "")
  });
  if (access?.ok) revalidatePath(`/s/${access.space.slug}`);
}

export async function removeBotAction(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  await removeSpaceBot({
    access,
    session: actor.session,
    email: actor.email,
    workspaceId: String(formData.get("workspaceId") || ""),
    slug: String(formData.get("bot") || "")
  });
  if (access?.ok) revalidatePath(`/s/${access.space.slug}`);
}

export async function hideSpacePostAction(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  await setSpacePostHidden({
    access,
    email: actor.email,
    postId: String(formData.get("postId") || ""),
    hidden: formData.get("hidden") !== "0"
  });
  if (access?.ok) revalidatePath(`/s/${access.space.slug}`);
}

export async function publishSpacePost(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  if (!access.ok) return { error: "That space could not be found." };
  const open = spaceWritesOpen(access);
  if (!open.ok) return { error: open.error };
  const text = cleanPostText(formData.get("text"));
  if (!text.ok) return { error: text.error };
  const saved = await addSpaceHumanPost({
    person: actor,
    space: access.space,
    text: text.text
  });
  if (!saved.ok) return { error: saved.error || "That post could not be saved." };
  revalidatePath(`/s/${access.space.slug}`);
  return { ok: true };
}

export async function publishSpaceComment(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  if (!access.ok) return { error: "That space could not be found." };
  const open = spaceWritesOpen(access);
  if (!open.ok) return { error: open.error };
  const text = cleanComment(formData.get("text"));
  if (!text.ok) return { error: text.error };
  const post = await findSpacePost(access.space.id, String(formData.get("postId") || ""));
  if (!post) return { error: "That post is gone." };
  const prepared = await prepareSpaceWrite({ spaceId: access.space.id, text: text.text });
  if (!prepared.ok) return { error: prepared.error };
  await insertComment({
    id: publicId("cmt"),
    postId: post.id,
    workspaceId: post.workspaceId,
    authorKind: "human",
    authorEmail: actor.email,
    authorName: actor.name,
    text: text.text,
    createdAt: utcStamp(),
    spaceId: access.space.id,
    authorWorkspaceId: actor.workspaceId
  });
  revalidatePath(`/s/${access.space.slug}`);
  return { ok: true };
}

export async function reactSpacePost(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  if (!access.ok) return;
  const open = spaceWritesOpen(access);
  if (!open.ok) return;
  const emoji = cleanEmoji(formData.get("emoji"));
  if (!emoji.ok || !REACTION_EMOJI.includes(emoji.emoji)) return;
  const post = await findSpacePost(access.space.id, String(formData.get("postId") || ""));
  if (!post) return;
  await addSpaceReaction({ post, actor: `human:${actor.email}`, emoji: emoji.emoji });
  revalidatePath(`/s/${access.space.slug}`);
}

export async function deleteOwnSpacePost(formData) {
  const actor = await person();
  if (!actor) return;
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  if (!access.ok) return;
  const post = await findSpacePost(access.space.id, String(formData.get("postId") || ""), { includeHidden: true });
  if (!post || post.authorKind !== "human" || post.workspaceId !== actor.workspaceId) return;
  await deletePostNow(post.id, post.workspaceId);
  revalidatePath(`/s/${access.space.slug}`);
}

export async function acceptSpaceInviteAction(formData) {
  const session = await auth();
  const workspaceId = await workspaceIdForSession(session);
  const role = workspaceId ? await workspaceRole(session, workspaceId) : null;
  const email = String(session?.user?.email || "").trim().toLowerCase();
  const result = await acceptSpaceInvite({
    inviteId: String(formData.get("inviteId") || ""),
    workspaceId,
    email,
    role
  });
  if (!result.ok) redirect(`/join/space/${String(formData.get("inviteId") || "")}?error=closed`);
  revalidatePath("/");
  redirect(`/s/${result.slug}`);
}
