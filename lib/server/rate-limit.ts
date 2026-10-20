import { createSupabaseAdminClient } from '@/lib/server/supabase-admin';

// Thin wrapper over the Postgres-side limiter consume_api_rate_limit
// (p_scope, p_user_id, p_limit, p_window_seconds). The service-role client is
// used because the call runs right after auth verification and must not be
// narrowed by RLS. Fail-closed: a limiter error denies the request, mirroring
// the employee-ask-ai route behavior.
export async function consumeRateLimit(
  scope: string,
  userId: string,
  limit: number,
  windowSeconds = 60
): Promise<boolean> {
  const { data: allowed, error } = await createSupabaseAdminClient().rpc(
    'consume_api_rate_limit',
    { p_scope: scope, p_user_id: userId, p_limit: limit, p_window_seconds: windowSeconds }
  );
  if (error) return false;
  return allowed === true;
}
