// Grants platform-staff access from the command line. This is how the very
// first SUPER_ADMIN is created; after that, super admins add other staff from
// /admin/staff. Deliberately not a web endpoint: whoever can run this already
// has the production database credentials.
//
// Usage (the person must have signed in to ScopeVanta at least once):
//   node --env-file=.env scripts/grant-staff.mjs you@example.com
//   node --env-file=.env scripts/grant-staff.mjs teammate@example.com SUPPORT
// Roles: SUPER_ADMIN (default), SUPPORT, BILLING.

import pg from "pg";
import { randomUUID } from "node:crypto";

const [email, role = "SUPER_ADMIN"] = process.argv.slice(2);
const ROLES = ["SUPER_ADMIN", "SUPPORT", "BILLING"];

if (!email) {
  console.error("Usage: node --env-file=.env scripts/grant-staff.mjs <email> [SUPER_ADMIN|SUPPORT|BILLING]");
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Unknown role "${role}". Use one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

const connectionString = process.env.MIGRATE_DATABASE_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env (or export it).");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  const { rows } = await client.query(`SELECT id, email FROM users WHERE lower(email) = lower($1)`, [email]);
  if (!rows.length) {
    console.error(`No user with email ${email}. Sign in to ScopeVanta once with that account, then run this again.`);
    process.exit(1);
  }
  const user = rows[0];
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO platform_staff (id, user_id, role, granted_by_user_id, revoked_at, created_at, updated_at)
     VALUES ($1, $2, $3::staff_role, NULL, NULL, now(), now())
     ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, revoked_at = NULL, updated_at = now()`,
    [randomUUID(), user.id, role],
  );
  await client.query(
    `INSERT INTO admin_audit_log (id, actor_user_id, actor_email, action, target_type, target_id, details, created_at)
     VALUES ($1, 'setup-script', 'setup-script', 'staff.grant', 'user', $2, $3::jsonb, now())`,
    [randomUUID(), user.id, JSON.stringify({ email: user.email, role, via: "scripts/grant-staff.mjs" })],
  );
  await client.query("COMMIT");
  console.log(`✓ ${user.email} is now ${role}. Set up two-factor authentication, sign in again, then open /admin.`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
