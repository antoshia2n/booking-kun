import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";
import { deleteCalendarEvent } from "./_calendar.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const { credential_id, calendar_id, event_id } = body;
  if (!credential_id || !event_id) return err("credential_id / event_id は必須です");

  try {
    const db = createDb(env);
    await deleteCalendarEvent(credential_id, db, env, calendar_id, event_id);
    return ok({ ok: true });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
