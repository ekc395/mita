-- ============================================================================
-- Fix: "permission denied for function log_activity" on every activity write.
--
-- 0001 revoked EXECUTE on log_activity from anon and authenticated, intending
-- to keep a SECURITY DEFINER function off the public RPC surface. But all four
-- of its callers -- set_anime_rank() and the want/follow/recommend trigger
-- functions -- are SECURITY INVOKER, so they invoke it *as* the authenticated
-- role. The revoke therefore broke ranking, follows, and the want list alike.
--
-- Granting EXECUTE back is safe: log_activity guards internally against
-- writing on another user's behalf (it raises unless p_user_id = auth.uid(),
-- allowing only a null uid, i.e. a trusted service-role/admin session). The
-- residual exposure is that a client may call it directly and fabricate feed
-- rows *for itself* -- an outcome it can already produce by ranking a title.
--
-- To close that too, move log_activity into a non-exposed schema (the Data API
-- serves `public` only) rather than revoking EXECUTE, which does not work here.
-- ============================================================================

grant execute on function
  public.log_activity(uuid, public.activity_type, integer, uuid, numeric)
  to authenticated;
