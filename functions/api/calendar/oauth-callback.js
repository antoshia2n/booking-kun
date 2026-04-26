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

  const appBaseUrl = env.APP_BASE_URL || "https://booking.shia2n.jp";

  // ユーザーが拒否したケース
  if (error) {
    return new Response(null, {
      status: 302,
      headers: {
        Location:   `${appBaseUrl}/admin/calendar?error=${encodeURIComponent(error)}`,
        "Set-Cookie": clearStateCookie(),
      },
    });
  }

  if (!code || !state) {
    return new Response("code または state が不足しています", { status: 400 });
  }

  // CSRF 対策：Cookie の state と照合
  const cookieState = getCookie(request, "bk_oauth_state");
  if (!cookieState || cookieState !== state) {
    return new Response("state が一致しません（CSRF の可能性）", { status: 400 });
  }

  try {
    // 1. 認証コードをトークンに交換
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirect_uri:  env.GOOGLE_CALENDAR_REDIRECT_URI,
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
      // prompt=consent を付けていれば通常は返るが、既に許可済みの場合は返らないことがある
      throw new Error(
        "refresh_token が取得できませんでした。Google Cloud Console の「テストユーザー」から一度このアカウントを削除し、再度連携してください。"
      );
    }

    // 2. ユーザー情報を取得（メールアドレス）
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new Error("ユーザー情報の取得に失敗しました");
    const userInfo  = await userRes.json();
    const email     = userInfo.email;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
    const scopes    = (scope || "").split(" ").filter(Boolean);

    // 3. bk_calendar_credentials に UPSERT
    const userId = env.DEFAULT_USER_ID;
    const db     = createDb(env);

    // 既存チェック
    const existing = await db.select("bk_calendar_credentials", {
      user_id: `eq.${userId}`,
      google_email: `eq.${email}`,
      limit: "1",
    });

    if (existing && existing.length > 0) {
      // 更新
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
      // 新規挿入
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

    // 4. 管理画面へリダイレクト（成功）
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
