import { getSql } from "./db.js";

export async function rememberHuman({ email, name, image }) {
  const sql = getSql();
  const rows = await sql`
    insert into humans (email, name, image)
    values (${email}, ${name || email}, ${image || null})
    on conflict (email) do update
      set name = excluded.name,
          image = coalesce(excluded.image, humans.image)
    returning email, name, image, onboarded_at
  `;
  return rows[0];
}

export async function dismissOnboarding(email) {
  const sql = getSql();
  await sql`update humans set onboarded_at = coalesce(onboarded_at, now()) where email = ${email}`;
}
