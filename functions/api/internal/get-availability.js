import { createDb, ok, err, handleOptions } from "./_db.js";

// JST 日付文字列 (YYYY-MM-DD) の weekday を取得（0=日, 1=月, ... 6=土）
function getJSTWeekday(dateStr) {
  const d = new Date(`${dateStr}T03:00:00Z`); // 正午 JST
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
}

// JST 日付 + 時刻 → UTC ISO 文字列
function jstToUTC(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 9, min)).toISOString();
}

// YYYY-MM-DD の範囲を配列で返す（日付を UTC 日として扱う）
function getDatesInRange(fromStr, toStr) {
  const dates = [];
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to   = new Date(`${toStr}T00:00:00Z`);
  let cur = new Date(from);
  while (cur <= to) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const eventTypeId = url.searchParams.get("event_type_id");
  const from        = url.searchParams.get("from"); // YYYY-MM-DD JST
  const to          = url.searchParams.get("to");   // YYYY-MM-DD JST

  if (!eventTypeId || !from || !to) {
    return err("event_type_id / from / to は必須です");
  }

  try {
    const db = createDb(env);

    // 予約タイプを取得
    const etRows = await db.select("bk_event_types", {
      id: `eq.${eventTypeId}`,
      active: "eq.true",
      limit: "1",
    });
    if (!etRows || etRows.length === 0) return err("予約タイプが見つかりません", 404);
    const et = etRows[0];

    const fixedSlots = et.fixed_slots;
    if (!fixedSlots || !fixedSlots.weekdays || !fixedSlots.slots) {
      return ok({ available_slots: [] });
    }

    const now = new Date();

    // 候補スロットを生成（JST 日付 × 固定時刻 → UTC）
    const candidates = [];
    const dates = getDatesInRange(from, to);
    for (const dateStr of dates) {
      const weekday = getJSTWeekday(dateStr);
      if (!fixedSlots.weekdays.includes(weekday)) continue;
      for (const timeStr of fixedSlots.slots) {
        const utcISO = jstToUTC(dateStr, timeStr);
        if (new Date(utcISO) > now) {
          candidates.push(utcISO);
        }
      }
    }

    if (candidates.length === 0) return ok({ available_slots: [] });

    // この期間内の確定済み予約を取得
    const fromUTC = jstToUTC(from, "00:00");
    const toUTC   = jstToUTC(to,   "23:59");

    const bookings = await db.select("bk_bookings", {
      event_type_id: `eq.${eventTypeId}`,
      status: "eq.confirmed",
      "start_at": [`gte.${fromUTC}`, `lte.${toUTC}`],
      select: "start_at",
    });

    const bookedSet = new Set((bookings || []).map((b) => new Date(b.start_at).toISOString()));

    const available = candidates.filter((c) => !bookedSet.has(new Date(c).toISOString()));

    return ok({ available_slots: available });
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
