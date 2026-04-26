// Google Calendar API ヘルパー
// このファイルは _ で始まるため、ルートとして登録されない
// パターンO：access_token / refresh_token はこのファイル内でのみ扱い、外部レスポンスに含めない

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_BASE    = "https://www.googleapis.com/calendar/v3";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5分前にリフレッシュ

/**
 * credential_id から有効な access_token を取得する。
 * expires_at が5分以内なら refresh_token で更新する。
 */
export async function getValidAccessToken(credentialId, db, env) {
  const rows = await db.select("bk_calendar_credentials", {
    id: `eq.${credentialId}`,
    active: "eq.true",
    limit: "1",
  });
  if (!rows || rows.length === 0) throw new Error("カレンダー連携が見つかりません");
  const cred = rows[0];

  const expiresAt = new Date(cred.expires_at).getTime();
  const now = Date.now();

  // まだ有効
  if (expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return cred.access_token;
  }

  // リフレッシュ
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: cred.refresh_token,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`トークンのリフレッシュに失敗しました: ${text}`);
  }

  const json = await res.json();
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await db.update(
    "bk_calendar_credentials",
    { id: `eq.${credentialId}` },
    {
      access_token: json.access_token,
      expires_at:   newExpiresAt,
      updated_at:   new Date().toISOString(),
    }
  );

  return json.access_token;
}

/** Google API への共通 fetch ラッパー */
async function callGoogle(method, url, accessToken, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API エラー (${res.status}): ${text}`);
  }
  // 204 No Content は JSON なし
  if (res.status === 204) return null;
  return res.json();
}

/** カレンダー一覧を取得 */
export async function listCalendars(credentialId, db, env) {
  const token = await getValidAccessToken(credentialId, db, env);
  const data  = await callGoogle("GET", `${CALENDAR_BASE}/users/me/calendarList`, token);
  return (data.items || []).map((item) => ({
    id:         item.id,
    summary:    item.summary,
    primary:    !!item.primary,
    accessRole: item.accessRole,
  }));
}

/** Free/Busy 取得 */
export async function getBusyTimes(credentialId, db, env, calendarId, timeMin, timeMax) {
  const token = await getValidAccessToken(credentialId, db, env);
  const data  = await callGoogle("POST", `${CALENDAR_BASE}/freeBusy`, token, {
    timeMin,
    timeMax,
    items: [{ id: calendarId || "primary" }],
  });
  const calKey = calendarId || "primary";
  return data.calendars?.[calKey]?.busy || [];
}

/** カレンダーにイベントを作成し、event_id を返す */
export async function createCalendarEvent(credentialId, db, env, calendarId, booking, eventTypeName) {
  const token = await getValidAccessToken(credentialId, db, env);

  const event = {
    summary: `${eventTypeName} - ${booking.attendee_name}`,
    description: [
      booking.reason ? `相談内容: ${booking.reason}` : null,
      `メール: ${booking.attendee_email}`,
      booking.attendee_phone ? `電話: ${booking.attendee_phone}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: booking.start_at, timeZone: "Asia/Tokyo" },
    end:   { dateTime: booking.end_at,   timeZone: "Asia/Tokyo" },
  };

  const calId = calendarId || "primary";
  const data  = await callGoogle("POST", `${CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events`, token, event);
  return data.id;
}

/** カレンダーからイベントを削除 */
export async function deleteCalendarEvent(credentialId, db, env, calendarId, eventId) {
  const token = await getValidAccessToken(credentialId, db, env);
  const calId = calendarId || "primary";
  await callGoogle("DELETE", `${CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events/${eventId}`, token);
}

/** Google の revoke エンドポイントを呼び出す */
export async function revokeGoogleToken(accessToken) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
    method: "POST",
  });
  // revoke 失敗してもDBを更新するので例外を投げない
}
