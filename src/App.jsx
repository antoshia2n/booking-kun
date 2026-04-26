import { useAuthUid, T } from "shia2n-core";
import { APP_NAME } from "./constants.js";

const S = {
  wrap: {
    minHeight: "100vh", background: T.bg,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 12, padding: 24,
    fontFamily: "'Hiragino Sans', 'Noto Sans JP', 'YuGothic', sans-serif",
  },
  title:   { fontSize: 18, fontWeight: 700, color: T.text },
  card: {
    background: T.surface, borderRadius: 10, padding: "14px 18px",
    display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 400,
    border: `1px solid ${T.border ?? "#e5e5e4"}`,
  },
  label:   { fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.5px" },
  link:    { fontSize: 13, color: "#2563eb", textDecoration: "none" },
  uid:     { fontSize: 11, color: T.muted, fontFamily: "'DM Mono', monospace" },
};

export default function App() {
  const uid = useAuthUid();

  return (
    <div style={S.wrap}>
      <div style={S.title}>{APP_NAME}</div>

      <div style={S.card}>
        <div style={S.label}>予約フォーム（公開）</div>
        <a href="/book/consultation" style={S.link}>/book/consultation</a>
      </div>

      <div style={S.card}>
        <div style={S.label}>管理</div>
        <a href="/admin/calendar"    style={S.link}>連携カレンダー</a>
        <a href="/admin/event-types" style={S.link}>予約タイプ管理</a>
      </div>

      <div style={S.uid}>uid: {uid ?? "—"}</div>
    </div>
  );
}
