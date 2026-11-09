import { getSql } from "./db.js";

export async function rememberHuman({ email, name, image, workspaceId = "" }) {
  const sql = getSql();
  const rows = await sql`
    insert into humans (email, name, image, workspace_id)
    values (${email}, ${name || email}, ${image || null}, ${workspaceId || null})
    on conflict (workspace_id, email) do update
      set name = excluded.name,
          image = coalesce(excluded.image, humans.image)
    returning email, name, image, onboarded_at
  `;
  if (workspaceId && email) {
    await sql`
      insert into workspace_members (workspace_id, email, role)
      values (${workspaceId}, ${email}, 'member')
      on conflict (workspace_id, email) do nothing
    `;
  }
  return rows[0];
}

export async function listHumans(workspaceId = "") {
  const sql = getSql();
  return sql`
    select humans.email, humans.name
    from humans
    join workspace_members members
      on lower(members.email) = lower(humans.email)
     and humans.workspace_id = members.workspace_id
    where members.workspace_id = ${workspaceId}
    order by humans.name asc
  `;
}

export async function dismissOnboarding(email, workspaceId = "") {
  const sql = getSql();
  await sql`
    update humans
    set onboarded_at = coalesce(onboarded_at, now())
    where lower(email) = ${String(email || "").toLowerCase()}
      and workspace_id = ${workspaceId}
  `;
}
