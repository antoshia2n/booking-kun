import { useAuthUid, T } from "shia2n-core";
import { APP_NAME } from "./constants.js";

const S = {
  wrap: {
    minHeight: "100vh",
    background: T.bg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
    fontFamily: "'Hiragino Sans', 'Noto Sans JP', 'YuGothic', sans-serif",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: T.text,
  },
  sub: {
    fontSize: 12,
    color: T.muted,
  },
  card: {
    background: T.surface,
    borderRadius: 10,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    maxWidth: 400,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: T.muted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  link: {
    fontSize: 13,
    color: T.primary ?? "#3b82f6",
    textDecoration: "none",
    fontFamily: "'DM Mono', monospace",
  },
  uid: {
    fontSize: 11,
    color: T.muted,
    fontFamily: "'DM Mono', monospace",
  },
};

export default function App() {
  const uid = useAuthUid();

  return (
    <div style={S.wrap}>
      <div style={S.title}>{APP_NAME}</div>
      <div style={S.sub}>管理画面は Phase 4 で実装予定</div>

      <div style={S.card}>
        <div style={S.label}>予約フォーム（公開）</div>
        <a
          href="/book/consultation"
          style={S.link}
        >
          /book/consultation
        </a>
      </div>

      <div style={S.uid}>uid: {uid ?? "—"}</div>
    </div>
  );
}
