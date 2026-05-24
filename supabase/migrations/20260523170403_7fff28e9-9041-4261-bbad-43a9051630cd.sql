
-- Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tighten notifications INSERT policy (only allow inserting rows for self;
-- trigger-based inserts run as SECURITY DEFINER and bypass RLS)
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- RLS policy calls and trigger invocations still work (evaluated as owner).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_project() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_comment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid, uuid) FROM anon, authenticated, public;
