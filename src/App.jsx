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
    fontSize: 20,
    fontWeight: 700,
    color: T.text,
    letterSpacing: "0.02em",
  },
  sub: {
    fontSize: 12,
    color: T.muted,
    letterSpacing: "0.03em",
  },
  uid: {
    fontSize: 11,
    color: T.muted,
    fontFamily: "'DM Mono', 'JetBrains Mono', monospace",
    background: T.surface,
    padding: "6px 12px",
    borderRadius: 6,
    marginTop: 8,
  },
};

export default function App() {
  const uid = useAuthUid();

  return (
    <div style={S.wrap}>
      <div style={S.title}>{APP_NAME}</div>
      <div style={S.sub}>Booking-kun — Phase 0</div>
      <div style={S.uid}>uid: {uid ?? "—"}</div>
    </div>
  );
}
