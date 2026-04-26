import { createDb, ok, err, handleOptions } from "./_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug   = url.searchParams.get("slug");
  const userId = url.searchParams.get("user_id") || env.DEFAULT_USER_ID;

  if (!slug) return err("slug は必須です");
  if (!userId) return err("user_id が設定されていません（DEFAULT_USER_ID を確認してください）", 500);

  try {
    const db = createDb(env);
    const rows = await db.select("bk_event_types", {
      slug: `eq.${slug}`,
      user_id: `eq.${userId}`,
      active: "eq.true",
      limit: "1",
    });

    if (!rows || rows.length === 0) return err("予約タイプが見つかりません", 404);
    return ok(rows[0]);
  } catch (e) {
    return err(e.message, 500);
  }
}

export async function onRequestOptions() {
  return handleOptions();
}
