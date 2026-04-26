import { createDb, ok, err, handleOptions } from "./_db.js";
import { createCalendarEvent } from "./_calendar.js";

function validateSlot(startAtISO, fixedSlots) {
  const date = new Date(startAtISO);
  const weekdayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(date);
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekdayShort];

  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return fixedSlots.weekdays.includes(weekday) && fixedSlots.slots.includes(timeStr);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return err("リクエストボディが不正です"); }

  const { event_type_id, attendee_name, attendee_email, attendee_phone, reason, start_at } = body;

  if (!event_type_id || !attendee_name || !attendee_email || !start_at) {
    return err("event_type_id / attendee_name / attendee_email / start_at は必須です");
  }

  if (new Date(start_at) < new Date()) return err("過去の日時には予約できません");

  try {
    const db = createDb(env);

    // 予約タイプ取得
    const etRows = await db.select("bk_event_types", {
      id:     `eq.${event_type_id}`,
      active: "eq.true",
      limit:  "1",
    });
    if (!etRows || etRows.length === 0) return err("予約タイプが見つかりません", 404);
    const et = etRows[0];

    // fixed_slots 検証
    if (et.fixed_slots && !validateSlot(start_at, et.fixed_slots)) {
      return err("指定された日時は予約できません");
    }

    // 重複チェック
    const existing = await db.select("bk_bookings", {
      event_type_id: `eq.${event_type_id}`,
      start_at:      `eq.${new Date(start_at).toISOString()}`,
      status:        "eq.confirmed",
      limit:         "1",
    });
    if (existing && existing.length > 0) return err("この時間はすでに予約が入っています", 409);

    const endAt       = new Date(new Date(start_at).getTime() + et.duration_minutes * 60 * 1000).toISOString();
    const cancelToken = crypto.randomUUID();

    // 予約 INSERT
    const booking = await db.insert("bk_bookings", {
      user_id:        et.user_id,
      event_type_id,
      attendee_name,
      attendee_email,
      attendee_phone: attendee_phone || null,
      reason:         reason || null,
      start_at:       new Date(start_at).toISOString(),
      end_at:         endAt,
      timezone:       "Asia/Tokyo",
      status:         "confirmed",
      cancel_token:   cancelToken,
    });

    // Googleカレンダー連携（失敗しても予約は成功扱い）
    if (et.use_calendar && et.calendar_credential_id) {
      try {
        const calId   = et.primary_calendar_id || et.calendar_id;
        const eventId = await createCalendarEvent(
          et.calendar_credential_id,
          db,
          env,
          calId,
          { ...booking, attendee_name, attendee_email, attendee_phone, reason },
          et.name
        );
        await db.update("bk_bookings", { id: `eq.${booking.id}` }, {
          google_calendar_event_id: eventId,
        });
        booking.google_calendar_event_id = eventId;
      } catch (calErr) {
        console.error("calendar event creation failed:", calErr.message);
      }
    }

    const appBaseUrl = env.APP_BASE_URL || "https://booking.shia2n.jp";

    return ok({
      booking_id:   booking.id,
      start_at:     booking.start_at,
      end_at:       booking.end_at,
      cancel_token: cancelToken,
      cancel_url:   `${appBaseUrl}/book/cancel/${cancelToken}`,
    });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
