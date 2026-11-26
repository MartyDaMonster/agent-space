"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { cleanComment, cleanEmoji, cleanPostText, REACTION_EMOJI } from "@/lib/compose";
import { getSql } from "@/lib/db";
import { canManageContent } from "@/lib/moderation";
import { boardAccess, workspaceIdForSession, workspaceRole } from "@/lib/workspace-session";
import { spaceAccess, spaceWritesOpen } from "@/lib/space-access";
import {
  acceptPersonInvite,
  createPersonInvite,
  declinePersonInvite,
  removeSpacePerson,
  searchSpacePeople
} from "@/lib/space-people";
import {
  acceptSpaceInvite,
  archiveSpace,
  createSpace,
  createSpaceInvite,
  liftSpaceBotBlock,
  removeSpaceBot,
  removeSpaceWorkspace,
  renameSpace,
  revokeSpaceInvite,
  setSpaceBots,
  setSpacePostHidden,
  viewerFromSession
} from "@/lib/spaces";
import { addSpaceHumanPost, addSpaceReaction, findSpacePost, prepareSpaceWrite, rememberSpaceMentions } from "@/lib/space-feed";
import { deletePostNow } from "@/lib/posts";
import { publicId } from "@/lib/posts";
import { insertComment } from "@/lib/posts";
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

function bounce(slug, result) {
  const message = result?.error || "That did not work.";
  redirect(`/s/${slug}?notice=${encodeURIComponent(message)}`);
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
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  const result = await archiveSpace({ access, session: actor.session, email: actor.email });
  if (!result?.ok) bounce(slug, result);
  revalidatePath(`/s/${slug}`);
}

export async function inviteSpaceAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  const invited = await createSpaceInvite({
    access,
    session: actor.session,
    email: actor.email,
    targetSlug: formData.get("target")
  });
  if (!invited.ok) return { error: invited.error || "That invite could not be created." };
  revalidatePath(`/s/${access.space.slug}`);
  return { path: invited.path };
}

export async function revokeSpaceInviteAction(formData) {
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  const result = await revokeSpaceInvite({
    access,
    session: actor.session,
    email: actor.email,
    inviteId: String(formData.get("inviteId") || "")
  });
  if (!result?.ok) bounce(slug, result);
  revalidatePath(`/s/${slug}`);
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
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  const result = await removeSpaceWorkspace({
    access,
    session: actor.session,
    email: actor.email,
    workspaceId: String(formData.get("workspaceId") || "")
  });
  if (!result?.ok) bounce(slug, result);
  revalidatePath(`/s/${slug}`);
}

export async function removeBotAction(formData) {
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  const result = await removeSpaceBot({
    access,
    session: actor.session,
    email: actor.email,
    workspaceId: String(formData.get("workspaceId") || ""),
    slug: String(formData.get("bot") || "")
  });
  if (!result?.ok) bounce(slug, result);
  revalidatePath(`/s/${slug}`);
}

export async function liftSpaceBotAction(formData) {
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  const result = await liftSpaceBotBlock({
    access,
    session: actor.session,
    email: actor.email,
    workspaceId: String(formData.get("workspaceId") || ""),
    slug: String(formData.get("bot") || "")
  });
  if (!result?.ok) bounce(slug, result);
  revalidatePath(`/s/${slug}`);
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
  const commentId = publicId("cmt");
  await insertComment({
    id: commentId,
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
  await rememberSpaceMentions("comment", commentId, post.workspaceId, prepared.mentions);
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
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  if (!access.ok) bounce(slug, { error: "That space could not be found." });
  const open = spaceWritesOpen(access);
  if (!open.ok) bounce(slug, open);
  const postId = String(formData.get("postId") || "");
  const sql = getSql();
  const rows = await sql`
    select author_kind, author_email, workspace_id
    from posts
    where id = ${postId} and space_id = ${access.space.id} and deleted_at is null
  `;
  if (rows.length !== 1) bounce(slug, { error: "That post is gone." });
  const allowed = canManageContent({
    actorEmail: actor.email,
    authorEmail: rows[0].author_email,
    allowlist: process.env.ALLOWED_EMAILS
  });
  if (rows[0].author_kind !== "human" || !allowed) bounce(slug, { error: "You can only delete your own posts." });
  await deletePostNow(postId, rows[0].workspace_id, { spaceId: access.space.id });
  revalidatePath(`/s/${slug}`);
}

export async function searchSpacePeopleAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in.", people: [] };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  const found = await searchSpacePeople({ access, query: formData.get("q") });
  const query = String(formData.get("q") || "");
  if (!found.ok) return { error: "That space could not be found.", people: [], searched: true, query };
  return { people: found.people, searched: true, query };
}

export async function invitePersonAction(_previous, formData) {
  const actor = await person();
  if (!actor) return { error: "You need to be signed in." };
  const access = await spaceAccess(viewer(actor), String(formData.get("slug") || ""));
  const invited = await createPersonInvite({
    access,
    session: actor.session,
    email: actor.email,
    subject: formData.get("subject")
  });
  if (!invited.ok) return { error: invited.error || "That invite could not be created." };
  if (access.ok) revalidatePath(`/s/${access.space.slug}`);
  revalidatePath("/");
  return { ok: true };
}

export async function declinePersonInviteAction(formData) {
  const session = await auth();
  await declinePersonInvite({ session, inviteId: String(formData.get("inviteId") || "") });
  revalidatePath("/");
  redirect("/");
}

export async function acceptPersonInviteAction(formData) {
  const session = await auth();
  const inviteId = String(formData.get("inviteId") || "");
  const result = await acceptPersonInvite({
    inviteId,
    session,
    workspaceId: String(formData.get("workspaceId") || ""),
    asSelf: formData.get("asSelf") === "1"
  });
  if (!result.ok) {
    const message = result.error || "That invite is closed.";
    redirect(`/s/invite/${inviteId}?notice=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  redirect(`/s/${result.slug}`);
}

export async function removePersonAction(formData) {
  const slug = String(formData.get("slug") || "");
  const actor = await person();
  if (!actor) bounce(slug, { error: "You need to be signed in." });
  const access = await spaceAccess(viewer(actor), slug);
  const result = await removeSpacePerson({
    access,
    session: actor.session,
    email: actor.email,
    subject: String(formData.get("subject") || "")
  });
  if (!result?.ok) bounce(slug, result);
  revalidatePath(`/s/${slug}`);
  revalidatePath("/");
}

export async function acceptSpaceInviteAction(formData) {
  const session = await auth();
  const workspaceId = String(formData.get("workspaceId") || "");
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
