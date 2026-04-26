import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";
import { createCalendarEvent } from "./_calendar.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const { credential_id, calendar_id, booking_id } = body;
  if (!credential_id || !booking_id) return err("credential_id / booking_id は必須です");

  try {
    const db = createDb(env);

    // 予約情報を取得
    const bookingRows = await db.select("bk_bookings", {
      id: `eq.${booking_id}`,
      limit: "1",
    });
    if (!bookingRows || bookingRows.length === 0) return err("予約が見つかりません", 404);
    const booking = bookingRows[0];

    // 予約タイプ名を取得
    const etRows = await db.select("bk_event_types", {
      id: `eq.${booking.event_type_id}`,
      select: "name",
      limit: "1",
    });
    const eventTypeName = etRows?.[0]?.name || "予約";

    // カレンダーイベント作成
    const eventId = await createCalendarEvent(credential_id, db, env, calendar_id, booking, eventTypeName);

    // bk_bookings に event_id を保存
    await db.update("bk_bookings", { id: `eq.${booking_id}` }, {
      google_calendar_event_id: eventId,
    });

    return ok({ event_id: eventId });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
