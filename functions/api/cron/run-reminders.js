/**
 * POST /api/cron/run-reminders
 * booking-kun-cron Worker から5分ごとに呼ばれるリマインダ実行エンドポイント。
 * 認証：Authorization: Bearer {CRON_SECRET}
 *
 * 処理フロー：
 * 1. status='confirmed' で 24h 前枠 / 1h 前枠に入る予約を取得
 * 2. 各予約に対して enroll-to-sequence を呼び出す
 * 3. reminder_*_sent フラグを true に更新（重複防止）
 */

import { enrollToHighShin, buildBookingMetadata } from "../../lib/enrollToHighShin.js";

function corsHeaders() {
  return {
    "Content-Type":                "application/json",
    "Access-Control-Allow-Origin": "*",
  };
}

function ok(data) {
  return new Response(JSON.stringify({ data, error: null }), { status: 200, headers: corsHeaders() });
}

function err(msg, status = 400) {
  return new Response(JSON.stringify({ data: null, error: msg }), { status, headers: corsHeaders() });
}

function supabaseFetch(env, table, params = {}) {
  const url = env.VITE_SUPABASE_URL;
  const key  = env.SUPABASE_SERVICE_ROLE_KEY;
  const qs   = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, item);
    } else {
      qs.set(k, v);
    }
  }
  return fetch(`${url}/rest/v1/${table}?${qs.toString()}`, {
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${key}`,
      apikey:          key,
      Prefer:          "return=representation",
    },
  });
}

async function supabaseUpdate(env, table, filter, data) {
  const url  = env.VITE_SUPABASE_URL;
  const key  = env.SUPABASE_SERVICE_ROLE_KEY;
  const qs   = new URLSearchParams(filter);
  const res  = await fetch(`${url}/rest/v1/${table}?${qs.toString()}`, {
    method: "PATCH",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${key}`,
      apikey:          key,
      Prefer:          "return=representation",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update error: ${text}`);
  }
  return res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // CRON_SECRET 認証
  const auth   = request.headers.get("Authorization") || "";
  const secret = (env.CRON_SECRET || "").trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return err("認証が必要です", 401);
  }

  const now       = Date.now();
  const appBase   = (env.APP_BASE_URL || "https://booking.shia2n.jp").trim();
  const results   = { reminder_24h: [], reminder_1h: [], errors: [] };

  try {
    // ── 24時間前リマインダ対象（23h〜24h の間で未送信）──────────
    const from24 = new Date(now + 23 * 3600 * 1000).toISOString();
    const to24   = new Date(now + 24 * 3600 * 1000).toISOString();

    const res24 = await supabaseFetch(env, "bk_bookings", {
      status:            "eq.confirmed",
      reminder_24h_sent: "eq.false",
      start_at:          [`gt.${from24}`, `lte.${to24}`],
    });
    const bookings24 = res24.ok ? await res24.json() : [];

    // ── 1時間前リマインダ対象（0h〜1h の間で未送信）────────────
    const from1h = new Date(now).toISOString();
    const to1h   = new Date(now + 1 * 3600 * 1000).toISOString();

    const res1h = await supabaseFetch(env, "bk_bookings", {
      status:           "eq.confirmed",
      reminder_1h_sent: "eq.false",
      start_at:         [`gt.${from1h}`, `lte.${to1h}`],
    });
    const bookings1h = res1h.ok ? await res1h.json() : [];

    // イベントタイプを一括取得（重複なし）
    const allBookings = [...bookings24, ...bookings1h];
    const etIdSet     = new Set(allBookings.map((b) => b.event_type_id));
    const etMap       = {};

    for (const etId of etIdSet) {
      try {
        const res = await supabaseFetch(env, "bk_event_types", {
          id:    `eq.${etId}`,
          limit: "1",
        });
        const rows = res.ok ? await res.json() : [];
        if (rows.length > 0) etMap[etId] = rows[0];
      } catch (e) {
        console.error(`[cron] event_type fetch failed etId=${etId}`, e.message);
      }
    }

    // ── 24h リマインダ処理 ─────────────────────────────────────
    for (const booking of bookings24) {
      const et = etMap[booking.event_type_id];
      if (!et) {
        results.errors.push({ booking_id: booking.id, reason: "event_type not found" });
        continue;
      }

      const result = await enrollToHighShin(env, {
        contact_email: booking.attendee_email,
        contact_name:  booking.attendee_name,
        trigger_key:   `booking_${et.slug}_reminder_24h`,
        user_id:       booking.user_id,
        metadata:      buildBookingMetadata({
          booking_id:      booking.id,
          event_type_name: et.name,
          start_at:        booking.start_at,
          end_at:          booking.end_at,
          duration_minutes: et.duration_minutes,
          cancel_token:    booking.cancel_token,
          app_base_url:    appBase,
        }),
      });

      // enroll 成否に関わらず sent フラグを立てる（重複防止優先）
      try {
        await supabaseUpdate(env, "bk_bookings", { id: `eq.${booking.id}` }, {
          reminder_24h_sent: true,
        });
        results.reminder_24h.push({ booking_id: booking.id, enroll_ok: result.ok });
      } catch (e) {
        console.error(`[cron] flag update failed booking_id=${booking.id}`, e.message);
        results.errors.push({ booking_id: booking.id, reason: e.message });
      }
    }

    // ── 1h リマインダ処理 ──────────────────────────────────────
    for (const booking of bookings1h) {
      const et = etMap[booking.event_type_id];
      if (!et) {
        results.errors.push({ booking_id: booking.id, reason: "event_type not found" });
        continue;
      }

      const result = await enrollToHighShin(env, {
        contact_email: booking.attendee_email,
        contact_name:  booking.attendee_name,
        trigger_key:   `booking_${et.slug}_reminder_1h`,
        user_id:       booking.user_id,
        metadata:      buildBookingMetadata({
          booking_id:      booking.id,
          event_type_name: et.name,
          start_at:        booking.start_at,
          end_at:          booking.end_at,
          duration_minutes: et.duration_minutes,
          cancel_token:    booking.cancel_token,
          app_base_url:    appBase,
        }),
      });

      try {
        await supabaseUpdate(env, "bk_bookings", { id: `eq.${booking.id}` }, {
          reminder_1h_sent: true,
        });
        results.reminder_1h.push({ booking_id: booking.id, enroll_ok: result.ok });
      } catch (e) {
        console.error(`[cron] flag update failed booking_id=${booking.id}`, e.message);
        results.errors.push({ booking_id: booking.id, reason: e.message });
      }
    }

    console.log("[cron/run-reminders] done", JSON.stringify(results));
    return ok(results);
  } catch (e) {
    console.error("[cron/run-reminders] fatal error", e.message);
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
