import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cancelToken = url.searchParams.get("cancel_token");
  const bookingId   = url.searchParams.get("booking_id");
  const userId      = url.searchParams.get("user_id");

  try {
    const db = createDb(env);

    // 公開アクセス：cancel_token で取得（限定情報のみ返す）
    if (cancelToken) {
      const rows = await db.select("bk_bookings", {
        cancel_token: `eq.${cancelToken}`,
        select: "id,attendee_name,start_at,end_at,status",
        limit: "1",
      });
      if (!rows || rows.length === 0) return err("予約が見つかりません", 404);
      return ok(rows[0]);
    }

    // 管理アクセス：booking_id + user_id + Bearer 認証
    if (!checkAuth(request, env)) return err("認証が必要です", 401);
    if (!bookingId || !userId)    return err("booking_id / user_id は必須です");

    const rows = await db.select("bk_bookings", {
      id: `eq.${bookingId}`,
      user_id: `eq.${userId}`,
      limit: "1",
    });
    if (!rows || rows.length === 0) return err("予約が見つかりません", 404);
    return ok(rows[0]);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
