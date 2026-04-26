import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) return err("認証が必要です", 401);

  const url    = new URL(request.url);
  const userId = url.searchParams.get("user_id") || env.DEFAULT_USER_ID;
  const status = url.searchParams.get("status"); // 省略可
  const from   = url.searchParams.get("from");   // YYYY-MM-DD UTC
  const to     = url.searchParams.get("to");     // YYYY-MM-DD UTC

  if (!userId) return err("user_id は必須です");

  try {
    const db = createDb(env);
    const params = {
      user_id: `eq.${userId}`,
      order: "start_at.asc",
    };
    if (status) params.status = `eq.${status}`;
    if (from)   params["start_at"] = [`gte.${from}T00:00:00Z`];
    if (to) {
      if (params["start_at"]) {
        params["start_at"].push(`lte.${to}T23:59:59Z`);
      } else {
        params["start_at"] = [`lte.${to}T23:59:59Z`];
      }
    }

    const rows = await db.select("bk_bookings", params);
    return ok(rows || []);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
