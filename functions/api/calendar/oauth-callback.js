// GET /api/calendar/oauth-callback?code=xxx&state=xxx
// アクセストークン交換 → bk_calendar_credentials 保存 → 管理画面へリダイレクト

import { createDb } from "../internal/_db.js";

const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match  = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearStateCookie() {
  return "bk_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // .trim() で改行・スペース混入を防ぐ（Cloudflare Console でのコピペ事故対策）
  const clientId     = (env.GOOGLE_CALENDAR_CLIENT_ID     || "").trim();
  const clientSecret = (env.GOOGLE_CALENDAR_CLIENT_SECRET || "").trim();
  const redirectUri  = (env.GOOGLE_CALENDAR_REDIRECT_URI  || "").trim();
  const appBaseUrl   = (env.APP_BASE_URL || "https://booking.shia2n.jp").trim();

  if (error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location:    `${appBaseUrl}/admin/calendar?error=${encodeURIComponent(error)}`,
        "Set-Cookie": clearStateCookie(),
      },
    });
  }

  if (!code || !state) {
    return new Response("code または state が不足しています", { status: 400 });
  }

  const cookieState = getCookie(request, "bk_oauth_state");
  if (!cookieState || cookieState !== state) {
    return new Response("state が一致しません（CSRF の可能性）", { status: 400 });
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`トークン交換失敗: ${text}`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in, scope } = tokenData;

    if (!refresh_token) {
      throw new Error(
        "refresh_token が取得できませんでした。Google アカウント設定 → セキュリティ → アクセス権のあるアプリ → booking-kun を削除してから再度連携してください。"
      );
    }

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new Error("ユーザー情報の取得に失敗しました");
    const userInfo  = await userRes.json();
    const email     = userInfo.email;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    const scopes    = (scope || "").split(" ").filter(Boolean);

    const userId = env.DEFAULT_USER_ID;
    const db     = createDb(env);

    const existing = await db.select("bk_calendar_credentials", {
      user_id:      `eq.${userId}`,
      google_email: `eq.${email}`,
      limit:        "1",
    });

    if (existing && existing.length > 0) {
      await db.update(
        "bk_calendar_credentials",
        { id: `eq.${existing[0].id}` },
        {
          access_token,
          refresh_token,
          expires_at: expiresAt,
          scopes,
          active:     true,
          revoked_at: null,
          updated_at: new Date().toISOString(),
        }
      );
    } else {
      await db.insert("bk_calendar_credentials", {
        user_id:      userId,
        google_email: email,
        access_token,
        refresh_token,
        expires_at:   expiresAt,
        scopes,
        active:       true,
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location:    `${appBaseUrl}/admin/calendar?connected=${encodeURIComponent(email)}`,
        "Set-Cookie": clearStateCookie(),
      },
    });
  } catch (e) {
    return new Response(null, {
      status: 302,
      headers: {
        Location:    `${appBaseUrl}/admin/calendar?error=${encodeURIComponent(e.message)}`,
        "Set-Cookie": clearStateCookie(),
      },
    });
  }
}
