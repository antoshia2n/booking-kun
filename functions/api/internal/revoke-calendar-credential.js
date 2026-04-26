import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";
import { revokeGoogleToken } from "./_calendar.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const { credential_id } = body;
  if (!credential_id) return err("credential_id は必須です");

  try {
    const db   = createDb(env);
    const rows = await db.select("bk_calendar_credentials", {
      id: `eq.${credential_id}`,
      limit: "1",
    });
    if (!rows || rows.length === 0) return err("連携が見つかりません", 404);

    // Google 側の revoke（失敗しても DB は更新する）
    await revokeGoogleToken(rows[0].access_token);

    // DB 更新
    await db.update(
      "bk_calendar_credentials",
      { id: `eq.${credential_id}` },
      {
        active:     false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    return ok({ ok: true });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
