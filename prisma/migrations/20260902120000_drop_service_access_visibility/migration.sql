-- serviceAccess nahradil přepis oprávnění `servis` (viz migrace 20260902100000_permissions),
-- strom viditelnosti (VisibilityNode) nebyl nikdy použit — nahrazen rozsahy v lib/permissions.ts
DROP TABLE IF EXISTS "visibility_node_users";
DROP TABLE IF EXISTS "visibility_nodes";
DROP TYPE IF EXISTS "Viditelnost";
ALTER TABLE "users" DROP COLUMN IF EXISTS "serviceAccess";
