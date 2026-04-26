// GET /api/calendar/oauth-start
// Google OAuth 同意画面へリダイレクト。state を Cookie に保存して CSRF 対策。

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function onRequestGet({ request, env }) {
  const clientId    = env.GOOGLE_CALENDAR_CLIENT_ID;
  const redirectUri = env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response(
      "GOOGLE_CALENDAR_CLIENT_ID または GOOGLE_CALENDAR_REDIRECT_URI が設定されていません",
      { status: 500 }
    );
  }

  // ランダム state 生成（CSRF 対策）
  const state  = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",  // 毎回 refresh_token を取得するため
    state,
  });

  // state を HttpOnly Cookie に保存（30分有効）
  const cookieValue = [
    `bk_oauth_state=${state}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=1800",
  ].join("; ");

  return new Response(null, {
    status: 302,
    headers: {
      Location:   `${GOOGLE_AUTH_URL}?${params.toString()}`,
      "Set-Cookie": cookieValue,
    },
  });
}
