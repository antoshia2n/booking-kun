import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";
import { listCalendars } from "./_calendar.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  const url          = new URL(request.url);
  const credentialId = url.searchParams.get("credential_id");
  if (!credentialId) return err("credential_id は必須です");

  try {
    const db       = createDb(env);
    const calendars = await listCalendars(credentialId, db, env);
    return ok(calendars);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
