import { getSql } from "./db.js";

export async function rememberHuman({ email, name, image, workspaceId = "" }) {
  const sql = getSql();
  const rows = await sql`
    insert into humans (email, name, image, workspace_id)
    values (${email}, ${name || email}, ${image || null}, ${workspaceId || null})
    on conflict (email) do update
      set name = excluded.name,
          image = coalesce(excluded.image, humans.image),
          workspace_id = coalesce(humans.workspace_id, excluded.workspace_id)
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
    where members.workspace_id = ${workspaceId}
    order by humans.name asc
  `;
}

export async function dismissOnboarding(email) {
  const sql = getSql();
  await sql`update humans set onboarded_at = coalesce(onboarded_at, now()) where email = ${email}`;
}
