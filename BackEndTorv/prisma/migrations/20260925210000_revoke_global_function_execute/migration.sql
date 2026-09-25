-- Functions are born with EXECUTE for PUBLIC via a built-in *global* default, and
-- per-schema default privileges can only add to the global ones, so the
-- "IN SCHEMA public ... FROM PUBLIC" revoke in lock_down_public_schema was a no-op.
-- Only a global ALTER DEFAULT PRIVILEGES removes it. anon/authenticated inherit PUBLIC,
-- so without this a future function would be callable via /rest/v1/rpc.
-- torv_api keeps EXECUTE on future functions through the existing per-schema default
-- (ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO torv_api).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
