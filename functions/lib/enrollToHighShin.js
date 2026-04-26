/**
 * 配信くん（High-Shin）の enroll-to-sequence を呼び出す共通ヘルパー。
 *
 * 実装仕様（HIGH_SHIN_SPEC.md §16）:
 *   POST /api/internal/enroll-to-sequence
 *   Authorization: Bearer {MCP_INTERNAL_SECRET}  ← 配信くん側のシークレット
 *   { contact_email, sequence_trigger_key, user_id, ... }
 *
 * 設計原則：
 * - 失敗しても呼び出し元の処理（予約・キャンセル）を止めない
 * - ログは必ず残す（Cloudflare Workers のログで追跡可能にする）
 * - パターンO：HIGH_SHIN_INTERNAL_SECRET は VITE_ プレフィックスなし、サーバー側のみで使用
 */

/**
 * JST の人間が読みやすい日時文字列を生成する。
 * 配信くん側のメール本文で置換変数として使える。
 */
function formatJSTDisplay(utcISO) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcISO));
}

/**
 * @param {object} env - Cloudflare Workers の env オブジェクト
 * @param {object} params
 * @param {string} params.contact_email
 * @param {string} params.contact_name
 * @param {string} params.trigger_key   - `booking_<slug>_<timing>` 形式
 * @param {string} params.user_id
 * @param {object} [params.metadata]    - メール本文置換用の追加情報
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function enrollToHighShin(env, {
  contact_email,
  contact_name,
  trigger_key,
  user_id,
  metadata = {},
}) {
  const baseUrl = (env.HIGH_SHIN_API_BASE || "").trim();
  const secret  = (env.HIGH_SHIN_INTERNAL_SECRET || "").trim();

  if (!baseUrl || !secret) {
    console.error("[enrollToHighShin] HIGH_SHIN_API_BASE または HIGH_SHIN_INTERNAL_SECRET が未設定");
    return { ok: false, error: "HIGH_SHIN 環境変数が未設定" };
  }

  const url  = `${baseUrl}/api/internal/enroll-to-sequence`;
  const body = {
    contact_email,
    contact_name,
    sequence_trigger_key: trigger_key, // HIGH_SHIN_SPEC §16 の正式パラメータ名
    user_id,
    metadata,
  };

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[enrollToHighShin] failed trigger_key=${trigger_key} status=${res.status}`, text);
      return { ok: false, error: text };
    }

    const data = await res.json();
    console.log(`[enrollToHighShin] ok trigger_key=${trigger_key} contact=${contact_email}`);
    return { ok: true, data };
  } catch (e) {
    console.error(`[enrollToHighShin] exception trigger_key=${trigger_key}`, String(e));
    return { ok: false, error: String(e) };
  }
}

/**
 * 予約情報から metadata を組み立てる共通関数。
 * 将来の配信くん側テンプレート変数として使える。
 */
export function buildBookingMetadata({ booking_id, event_type_name, start_at, end_at, duration_minutes, cancel_token, app_base_url }) {
  const cancelUrl = cancel_token ? `${app_base_url}/book/cancel/${cancel_token}` : null;

  return {
    booking_id,
    event_type_name,
    start_at,
    start_at_jst_display: formatJSTDisplay(start_at),
    end_at,
    duration_minutes,
    cancel_url: cancelUrl,
  };
}
