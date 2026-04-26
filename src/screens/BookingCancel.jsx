import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const C = {
  bg: "#f5f5f3",
  surface: "#ffffff",
  text: "#111110",
  muted: "#888",
  border: "#e5e5e4",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
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
  title: { fontSize: 18, fontWeight: 700, color: C.text, textAlign: "center" },
  card: {
    background: C.surface,
    borderRadius: 12,
    padding: "16px 20px",
    border: `1px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    fontSize: 10, fontWeight: 600, color: C.muted,
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  value: { fontSize: 14, color: C.text, fontWeight: 600 },
  textarea: {
    padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.surface,
    fontSize: 14, color: C.text, outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "inherit",
    resize: "vertical", minHeight: 72,
  },
  cancelBtn: {
    padding: "13px 0", borderRadius: 8, border: "none",
    background: C.danger, color: "#fff",
    fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%",
  },
  muted: { fontSize: 12, color: C.muted, textAlign: "center", padding: "32px 0" },
  info: { fontSize: 12, color: C.muted, lineHeight: 1.7 },
};

function formatDateTimeJST(utcISO) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(utcISO));
}

export default function BookingCancel() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [done, setDone] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/internal/get-booking?cancel_token=${token}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setBooking(json.data);
      } catch (e) {
        setLoadError(e.message || "予約情報の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch("/api/internal/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_token: token, cancel_reason: cancelReason }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setDone(true);
    } catch (e) {
      setCancelError(e.message || "キャンセルに失敗しました");
      setCancelling(false);
    }
  }

  if (loading) return <div style={S.page}><div style={S.muted}>読み込み中...</div></div>;
  if (loadError) return <div style={S.page}><div style={{ ...S.muted, color: C.danger }}>{loadError}</div></div>;
  if (!booking) return <div style={S.page}><div style={S.muted}>予約が見つかりません</div></div>;

  if (booking.status === "cancelled") {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={{ fontSize: 32, textAlign: "center" }}>ℹ️</div>
          <div style={S.title}>キャンセル済みです</div>
          <div style={{ ...S.card, background: C.dangerBg, borderColor: C.dangerBorder }}>
            <div style={S.info}>この予約はすでにキャンセルされています。</div>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={{ fontSize: 32, textAlign: "center" }}>✅</div>
          <div style={S.title}>キャンセルが完了しました</div>
          <div style={{ ...S.card, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <div style={{ ...S.info, color: "#166534" }}>
              予約のキャンセルが完了しました。またのご予約をお待ちしております。
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={{ fontSize: 32, textAlign: "center" }}>🗓️</div>
        <div style={S.title}>予約のキャンセル</div>

        <div style={S.card}>
          <div>
            <div style={S.label}>お名前</div>
            <div style={S.value}>{booking.attendee_name} 様</div>
          </div>
          <div>
            <div style={S.label}>予約日時</div>
            <div style={S.value}>{formatDateTimeJST(booking.start_at)}</div>
          </div>
        </div>

        <div style={S.card}>
          <div>
            <div style={S.label}>キャンセル理由（任意）</div>
            <textarea
              style={S.textarea}
              placeholder="キャンセルの理由があればご記入ください"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          {cancelError && (
            <div style={{ fontSize: 12, color: C.danger }}>{cancelError}</div>
          )}
          <button
            style={{
              ...S.cancelBtn,
              opacity: cancelling ? 0.6 : 1,
              cursor: cancelling ? "not-allowed" : "pointer",
            }}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "処理中..." : "この予約をキャンセルする"}
          </button>
        </div>
      </div>
    </div>
  );
}
