import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const {
    event_type_id,
    user_id,
    use_calendar,
    calendar_credential_id,
    calendar_id,
    name,
    description,
    active,
    fixed_slots,
  } = body;

  if (!event_type_id) return err("event_type_id は必須です");

  const uid = user_id || env.DEFAULT_USER_ID;
  const updates = {};
  if (use_calendar             !== undefined) updates.use_calendar             = use_calendar;
  if (calendar_credential_id   !== undefined) updates.calendar_credential_id   = calendar_credential_id;
  if (calendar_id              !== undefined) updates.calendar_id              = calendar_id;
  if (name                     !== undefined) updates.name                     = name;
  if (description              !== undefined) updates.description              = description;
  if (active                   !== undefined) updates.active                   = active;
  if (fixed_slots              !== undefined) updates.fixed_slots              = fixed_slots;

  try {
    const db  = createDb(env);
    const row = await db.update("bk_event_types", {
      id:      `eq.${event_type_id}`,
      user_id: `eq.${uid}`,
    }, updates);
    return ok(row);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
