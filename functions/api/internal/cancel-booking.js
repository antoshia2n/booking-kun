import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return err("リクエストボディが不正です");
  }

  const { cancel_token, booking_id, user_id, cancel_reason } = body;

  // 認証方式の判定
  // A. cancel_token あり → 公開キャンセル（認証不要）
  // B. booking_id + user_id + Bearer → 管理キャンセル
  const isPublic = !!cancel_token;
  const isAdmin  = !isPublic && checkAuth(request, env);

  if (!isPublic && !isAdmin) return err("認証が必要です", 401);

  try {
    const db = createDb(env);
    let booking;

    if (isPublic) {
      const rows = await db.select("bk_bookings", {
        cancel_token: `eq.${cancel_token}`,
        limit: "1",
      });
      if (!rows || rows.length === 0) return err("予約が見つかりません", 404);
      booking = rows[0];
    } else {
      const rows = await db.select("bk_bookings", {
        id: `eq.${booking_id}`,
        user_id: `eq.${user_id}`,
        limit: "1",
      });
      if (!rows || rows.length === 0) return err("予約が見つかりません", 404);
      booking = rows[0];
    }

    if (booking.status === "cancelled") {
      return err("この予約はすでにキャンセルされています", 409);
    }

    // キャンセル実行
    const updated = await db.update(
      "bk_bookings",
      { id: `eq.${booking.id}` },
      {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancel_reason || null,
      }
    );

    return ok({ booking_id: booking.id, status: "cancelled" });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
