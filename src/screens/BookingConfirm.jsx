import { useSearchParams } from "react-router-dom";

const C = {
  bg: "#f5f5f3",
  surface: "#ffffff",
  text: "#111110",
  muted: "#888",
  border: "#e5e5e4",
  primary: "#2563eb",
  success: "#16a34a",
};

const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 16px 48px",
    fontFamily: "'Hiragino Sans', 'Noto Sans JP', 'YuGothic', sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  badge: {
    fontSize: 32,
    textAlign: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
    textAlign: "center",
  },
  card: {
    background: C.surface,
    borderRadius: 12,
    padding: "16px 20px",
    border: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  value: {
    fontSize: 14,
    color: C.text,
    fontWeight: 600,
  },
  note: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 1.7,
  },
  cancelLink: {
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    marginTop: 4,
  },
  anchor: {
    color: C.primary,
    textDecoration: "underline",
    wordBreak: "break-all",
  },
};

function formatDateTimeJST(utcISO) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcISO));
}

export default function BookingConfirm() {
  const [params] = useSearchParams();
  const startAt    = params.get("start_at");
  const name       = params.get("name");
  const cancelToken = params.get("cancel_token");

  const cancelUrl = cancelToken
    ? `${window.location.origin}/book/cancel/${cancelToken}`
    : null;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.badge}>✅</div>
        <div style={S.title}>予約が完了しました</div>

        <div style={S.card}>
          {name && (
            <div style={S.row}>
              <div style={S.label}>お名前</div>
              <div style={S.value}>{name} 様</div>
            </div>
          )}
          {startAt && (
            <div style={S.row}>
              <div style={S.label}>予約日時</div>
              <div style={S.value}>{formatDateTimeJST(startAt)}</div>
            </div>
          )}
        </div>

        <div style={{ ...S.card, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <div style={{ ...S.note, color: "#166534" }}>
            ご予約ありがとうございます。確認メールをお送りします（設定後）。
            当日はどうぞよろしくお願いします。
          </div>
        </div>

        {cancelUrl && (
          <div style={S.cancelLink}>
            キャンセルは{" "}
            <a href={cancelUrl} style={S.anchor}>
              こちら
            </a>
            {" "}から可能です
          </div>
        )}
      </div>
    </div>
  );
}
