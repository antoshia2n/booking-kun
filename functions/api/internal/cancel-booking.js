import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";
import { deleteCalendarEvent } from "./_calendar.js";
import { enrollToHighShin, buildBookingMetadata } from "../../lib/enrollToHighShin.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const { cancel_token, booking_id, user_id, cancel_reason } = body;
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
        id:      `eq.${booking_id}`,
        user_id: `eq.${user_id}`,
        limit:   "1",
      });
      if (!rows || rows.length === 0) return err("予約が見つかりません", 404);
      booking = rows[0];
    }

    if (booking.status === "cancelled") return err("この予約はすでにキャンセルされています", 409);

    // キャンセル実行
    await db.update(
      "bk_bookings",
      { id: `eq.${booking.id}` },
      {
        status:        "cancelled",
        cancelled_at:  new Date().toISOString(),
        cancel_reason: cancel_reason || null,
      }
    );

    // 予約タイプ取得（slug・name・カレンダー情報のために必要）
    const etRows = await db.select("bk_event_types", {
      id:    `eq.${booking.event_type_id}`,
      limit: "1",
    });
    const et = etRows?.[0];

    // ── Phase 2：Googleカレンダーからイベント削除（失敗してもキャンセルは成功扱い）
    if (booking.google_calendar_event_id && et?.calendar_credential_id) {
      try {
        const credRows = await db.select("bk_calendar_credentials", {
          id:    `eq.${et.calendar_credential_id}`,
          limit: "1",
        });
        const cred = credRows?.[0];

        if (cred?.active) {
          const calId = cred.primary_calendar_id || "primary";
          await deleteCalendarEvent(
            et.calendar_credential_id,
            db,
            env,
            calId,
            booking.google_calendar_event_id
          );
        }
      } catch (calErr) {
        console.error("[cancel-booking] calendar event deletion failed:", calErr.message);
      }
    }

    const appBaseUrl = (env.APP_BASE_URL || "https://booking.shia2n.jp").trim();

    // ── Phase 3：配信くん enroll（失敗してもキャンセルは成功扱い）
    if (et) {
      await enrollToHighShin(env, {
        contact_email: booking.attendee_email,
        contact_name:  booking.attendee_name,
        trigger_key:   `booking_${et.slug}_cancelled`,
        user_id:       booking.user_id,
        metadata:      buildBookingMetadata({
          booking_id:      booking.id,
          event_type_name: et.name,
          start_at:        booking.start_at,
          end_at:          booking.end_at,
          duration_minutes: et.duration_minutes,
          cancel_token:    booking.cancel_token,
          app_base_url:    appBaseUrl,
        }),
      });
    }

    return ok({ booking_id: booking.id, status: "cancelled" });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
