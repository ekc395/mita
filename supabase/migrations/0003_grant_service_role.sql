-- ============================================================================
-- Fix: "permission denied for table anime" when the server fills the cache.
--
-- 0001 granted table privileges to `authenticated` but never to `service_role`,
-- on the assumption that bypassing RLS was enough. It is not: RLS sits on top
-- of table grants rather than replacing them, so a role with no GRANT is
-- refused before RLS is ever consulted. Same failure mode as 0002 -- there the
-- caller was a SECURITY INVOKER function, here it is the service-role client.
--
-- Normally Supabase's default privileges hand service_role everything in
-- `public`, but this project has "automatically expose new tables" disabled,
-- which switches those defaults off for every role.
--
-- service_role is granted broadly and deliberately: it is the admin escape
-- hatch, and restricting it would only invite confusing failures later. Its
-- security boundary is that the key never reaches a browser -- enforced by
-- keeping createServiceRoleClient() server-side -- not by narrow privileges.
-- ============================================================================

grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Anything added by a later migration inherits the same access.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant all privileges on functions to service_role;
