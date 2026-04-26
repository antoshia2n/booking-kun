import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";
import { getBusyTimes } from "./_calendar.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  const url          = new URL(request.url);
  const credentialId = url.searchParams.get("credential_id");
  const calendarId   = url.searchParams.get("calendar_id");
  const timeMin      = url.searchParams.get("time_min");
  const timeMax      = url.searchParams.get("time_max");

  if (!credentialId || !timeMin || !timeMax) {
    return err("credential_id / time_min / time_max は必須です");
  }

  try {
    const db   = createDb(env);
    const busy = await getBusyTimes(credentialId, db, env, calendarId, timeMin, timeMax);
    return ok(busy);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
