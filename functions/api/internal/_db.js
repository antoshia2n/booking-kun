// Cloudflare Pages Functions 共有 Supabase ヘルパー
// このファイルは _ で始まるため、ルートとして登録されない

export function createDb(env) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  const baseHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
    Prefer: "return=representation",
  };

  return {
    async select(table, params = {}) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) {
          for (const item of v) qs.append(k, item);
        } else {
          qs.set(k, v);
        }
      }
      const res = await fetch(`${url}/rest/v1/${table}?${qs.toString()}`, {
        headers: baseHeaders,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase select error: ${text}`);
      }
      return res.json();
    },

    async insert(table, data) {
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase insert error: ${text}`);
      }
      const rows = await res.json();
      return Array.isArray(rows) ? rows[0] : rows;
    },

    async update(table, filterParams, data) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(filterParams)) qs.set(k, v);
      const res = await fetch(`${url}/rest/v1/${table}?${qs.toString()}`, {
        method: "PATCH",
        headers: baseHeaders,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase update error: ${text}`);
      }
      const rows = await res.json();
      return Array.isArray(rows) ? rows[0] : rows;
    },
  };
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Content-Type": "application/json",
  };
}

export function ok(data) {
  return new Response(JSON.stringify({ data, error: null }), {
    status: 200,
    headers: corsHeaders(),
  });
}

export function err(message, status = 400) {
  return new Response(JSON.stringify({ data: null, error: message }), {
    status,
    headers: corsHeaders(),
  });
}

/**
 * 2つの認証モードをサポート：
 * 1. AI/MCP 用：Authorization: Bearer {BK_INTERNAL_SECRET}
 * 2. 管理UI 用：X-User-Id: {firebase_uid}（DEFAULT_USER_ID と照合）
 *    ※ BK_INTERNAL_SECRET をブラウザに渡さないためのパターンO対策
 */
export function checkAuth(request, env) {
  // モード1：Bearer トークン
  const auth = request.headers.get("Authorization") ?? "";
  if (env.BK_INTERNAL_SECRET && auth === `Bearer ${env.BK_INTERNAL_SECRET}`) return true;

  // モード2：X-User-Id（管理UI用）
  const uid = request.headers.get("X-User-Id") ?? "";
  if (uid && env.DEFAULT_USER_ID && uid === env.DEFAULT_USER_ID) return true;

  return false;
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
