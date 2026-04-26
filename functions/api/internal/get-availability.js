import { createDb, ok, err, handleOptions } from "./_db.js";
import { getBusyTimes } from "./_calendar.js";

function getJSTWeekday(dateStr) {
  const d  = new Date(`${dateStr}T03:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
}

function jstToUTC(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min]  = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 9, min)).toISOString();
}

function getDatesInRange(fromStr, toStr) {
  const dates = [];
  const from  = new Date(`${fromStr}T00:00:00Z`);
  const to    = new Date(`${toStr}T00:00:00Z`);
  let cur = new Date(from);
  while (cur <= to) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url         = new URL(request.url);
  const eventTypeId = url.searchParams.get("event_type_id");
  const from        = url.searchParams.get("from");
  const to          = url.searchParams.get("to");

  if (!eventTypeId || !from || !to) {
    return err("event_type_id / from / to は必須です");
  }

  try {
    const db = createDb(env);

    const etRows = await db.select("bk_event_types", {
      id:     `eq.${eventTypeId}`,
      active: "eq.true",
      limit:  "1",
    });
    if (!etRows || etRows.length === 0) return err("予約タイプが見つかりません", 404);
    const et = etRows[0];

    const fixedSlots = et.fixed_slots;
    if (!fixedSlots || !fixedSlots.weekdays || !fixedSlots.slots) {
      return ok({ available_slots: [] });
    }

    const now = new Date();

    // 候補スロット生成
    const candidates = [];
    const dates = getDatesInRange(from, to);
    for (const dateStr of dates) {
      const weekday = getJSTWeekday(dateStr);
      if (!fixedSlots.weekdays.includes(weekday)) continue;
      for (const timeStr of fixedSlots.slots) {
        const utcISO = jstToUTC(dateStr, timeStr);
        if (new Date(utcISO) > now) candidates.push(utcISO);
      }
    }

    if (candidates.length === 0) return ok({ available_slots: [] });

    // 確定済み予約で除外
    const fromUTC = jstToUTC(from, "00:00");
    const toUTC   = jstToUTC(to,   "23:59");

    const bookings = await db.select("bk_bookings", {
      event_type_id: `eq.${eventTypeId}`,
      status:        "eq.confirmed",
      start_at:      [`gte.${fromUTC}`, `lte.${toUTC}`],
      select:        "start_at",
    });
    const bookedSet = new Set((bookings || []).map((b) => new Date(b.start_at).toISOString()));

    let available = candidates.filter((c) => !bookedSet.has(new Date(c).toISOString()));

    // Google カレンダー連携：busy 時間で除外
    if (et.use_calendar && et.calendar_credential_id) {
      try {
        const busy = await getBusyTimes(
          et.calendar_credential_id,
          db,
          env,
          et.primary_calendar_id || et.calendar_id,
          fromUTC,
          toUTC
        );

        if (busy.length > 0) {
          available = available.filter((slotISO) => {
            const slotStart = new Date(slotISO).getTime();
            const slotEnd   = slotStart + et.duration_minutes * 60 * 1000;
            return !busy.some((b) => {
              const bStart = new Date(b.start).getTime();
              const bEnd   = new Date(b.end).getTime();
              return slotStart < bEnd && slotEnd > bStart;
            });
          });
        }
      } catch (calErr) {
        // カレンダー取得失敗は固定スロットにフォールバック（予約不可にしない）
        console.error("busy times fetch failed:", calErr.message);
      }
    }

    return ok({ available_slots: available });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
