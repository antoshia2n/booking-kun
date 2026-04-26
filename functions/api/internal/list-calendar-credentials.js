import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  const url    = new URL(request.url);
  const userId = url.searchParams.get("user_id") || env.DEFAULT_USER_ID;

  try {
    const db   = createDb(env);
    const rows = await db.select("bk_calendar_credentials", {
      user_id: `eq.${userId}`,
      order:   "created_at.asc",
      // パターンO：access_token / refresh_token をレスポンスに含めない
      select:  "id,user_id,google_email,display_name,active,primary_calendar_id,expires_at,scopes,created_at,updated_at,revoked_at",
    });
    return ok(rows || []);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
