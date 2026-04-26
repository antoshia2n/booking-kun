import { createDb, ok, err, checkAuth, handleOptions } from "./_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id") || env.DEFAULT_USER_ID;

  // 公開アクセス or 認証あり → 認証なしでも active 一覧は返す
  if (!userId) return err("user_id が設定されていません", 400);

  try {
    const db = createDb(env);
    const params = {
      user_id: `eq.${userId}`,
      order: "created_at.asc",
    };

    // 認証ありの場合は非 active も返す、なしは active のみ
    if (!checkAuth(request, env)) {
      params.active = "eq.true";
    }

    const rows = await db.select("bk_event_types", params);
    return ok(rows || []);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
