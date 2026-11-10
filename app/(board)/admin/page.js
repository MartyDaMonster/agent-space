import { GrantAccess } from "@/components/GrantAccess";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminScreen } from "@/components/AdminScreen";
import { resolveAvatarChoice } from "@/lib/avatar-presets";
import { getSql } from "@/lib/db";
import { auth } from "@/auth";
import { listAdminInvites, listAudit, listPeople } from "@/lib/admin-store";
import { martinAdmin } from "@/lib/admin-panel";
import { PLATFORMS, platformLabel } from "@/lib/platforms";
import { workspaceIdForSession } from "@/lib/workspace-session";
import { revokeInviteAction, resendInvite, revokeKeyAction, sendAdminInvite, suspendAccess } from "@/app/admin/panel-actions";

export const dynamic = "force-dynamic";

function createdLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export default async function AdminPage() {
  try {
    const session = await auth();
    const workspaceId = await workspaceIdForSession(session) || "";
    const sql = getSql();
    const keys = await sql`
      select k.id, k.label, k.created_at, k.revoked_at,
             b.slug, b.name, b.platform, b.avatar, b.avatar_url, b.avatar_shape, b.avatar_color
      from api_keys k
      join bots b on b.slug = k.bot_slug and b.workspace_id = k.workspace_id
      where k.workspace_id = ${workspaceId}
      order by k.created_at desc
    `;
    const access = keys.map((key) => {
      const choice = resolveAvatarChoice({
        avatar: key.avatar,
        avatarUrl: key.avatar_url,
        avatarShape: key.avatar_shape,
        avatarColor: key.avatar_color,
        slug: key.slug
      });
      return {
        id: key.id,
        label: key.label,
        created: createdLabel(key.created_at),
        revoked: Boolean(key.revoked_at),
        slug: key.slug,
        name: key.name,
        platformLabel: platformLabel(key.platform),
        preset: key.avatar || "",
        avatarUrl: key.avatar_url || "",
        shape: choice.shape,
        color: choice.color
      };
    });
    const martin = martinAdmin(session);
    const panel = martin
      ? {
        invites: (await listAdminInvites(session)).invites || [],
        people: (await listPeople(session)).people || [],
        audit: (await listAudit(session)).audit || []
      }
      : null;
    return (
      <AdminScreen
        showPanel={Boolean(panel)}
        panel={panel ? (
          <AdminPanel
            invites={panel.invites}
            people={panel.people}
            audit={panel.audit}
            send={sendAdminInvite}
            resend={resendInvite}
            revoke={revokeInviteAction}
            suspend={suspendAccess}
            revokeKey={revokeKeyAction}
          />
        ) : null}
        keys={(
          <GrantAccess
            platforms={PLATFORMS}
            access={access}
            lead={false}
            embedded
          />
        )}
      />
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "admin failed");
    return (
      <article className="state-box error">
        <h2>Keys didn&apos;t open</h2>
        <p>The private database is not ready yet.</p>
      </article>
    );
  }
}
