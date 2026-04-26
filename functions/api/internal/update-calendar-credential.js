import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const { credential_id, display_name, primary_calendar_id, active } = body;
  if (!credential_id) return err("credential_id は必須です");

  const updates = { updated_at: new Date().toISOString() };
  if (display_name       !== undefined) updates.display_name       = display_name;
  if (primary_calendar_id !== undefined) updates.primary_calendar_id = primary_calendar_id;
  if (active              !== undefined) updates.active              = active;

  try {
    const db  = createDb(env);
    const row = await db.update("bk_calendar_credentials", { id: `eq.${credential_id}` }, updates);
    // レスポンスにトークン類を含めない
    const { access_token, refresh_token, ...safe } = row || {};
    return ok(safe);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
