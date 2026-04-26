import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

// ─── 日付・時刻ユーティリティ ─────────────────────────────
function getJSTWeekday(dateStr) {
  const d = new Date(`${dateStr}T03:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(d);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T03:00:00Z`);
  const md = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(d);
  const wd = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(d);
  return `${md}（${wd}）`;
}

function formatTimeLabel(utcISO) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcISO));
}

function formatDateTimeLabel(utcISO) {
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

function getTodayJST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date()
  );
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

// ─── スタイル ─────────────────────────────────────────────
const C = {
  bg: "#f5f5f3",
  surface: "#ffffff",
  text: "#111110",
  muted: "#888",
  border: "#e5e5e4",
  primary: "#2563eb",
  primaryText: "#ffffff",
  danger: "#dc2626",
  success: "#16a34a",
};

const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 16px 48px",
    fontFamily: "'Hiragino Sans', 'Noto Sans JP', 'YuGothic', sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    textAlign: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
    margin: 0,
  },
  desc: {
    fontSize: 13,
    color: C.muted,
    margin: "6px 0 0",
    lineHeight: 1.6,
  },
  card: {
    background: C.surface,
    borderRadius: 12,
    padding: 16,
    border: `1px solid ${C.border}`,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: C.text,
    marginBottom: 12,
  },
  dateRow: (selected) => ({
    borderRadius: 8,
    border: `1px solid ${selected ? C.primary : C.border}`,
    background: selected ? "#eff6ff" : C.surface,
    overflow: "hidden",
    cursor: "pointer",
  }),
  dateHeader: {
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    padding: "0 14px 14px",
  },
  slotBtn: {
    padding: "10px 0",
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.bg,
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: "'DM Mono', monospace",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    fontSize: 14,
    color: C.text,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    fontSize: 14,
    color: C.text,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: 80,
  },
  primaryBtn: {
    padding: "13px 0",
    borderRadius: 8,
    border: "none",
    background: C.primary,
    color: C.primaryText,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  backLink: {
    fontSize: 12,
    color: C.muted,
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 0,
    textDecoration: "underline",
    display: "inline-block",
    marginBottom: 8,
  },
  selectedSlotTag: {
    fontSize: 13,
    color: C.primary,
    fontWeight: 600,
    padding: "8px 12px",
    background: "#eff6ff",
    borderRadius: 8,
    border: `1px solid ${C.primary}`,
    marginBottom: 4,
  },
  error: {
    fontSize: 12,
    color: C.danger,
    padding: "8px 12px",
    background: "#fef2f2",
    borderRadius: 8,
    border: `1px solid #fecaca`,
  },
  muted: {
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    padding: "32px 0",
  },
};

// ─── コンポーネント ───────────────────────────────────────
export default function BookingForm() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [eventType, setEventType] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const [form, setForm] = useState({ name: "", email: "", phone: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // イベントタイプ + 空き時間を取得
  useEffect(() => {
    async function load() {
      try {
        // 1. イベントタイプ取得
        const etRes = await fetch(`/api/internal/get-event-type?slug=${slug}`);
        const etJson = await etRes.json();
        if (etJson.error) throw new Error(etJson.error);
        const et = etJson.data;
        setEventType(et);

        // 2. 空き時間取得（今日から14日間）
        const today = getTodayJST();
        const to = addDays(today, 13);
        const avRes = await fetch(
          `/api/internal/get-availability?event_type_id=${et.id}&from=${today}&to=${to}`
        );
        const avJson = await avRes.json();
        if (avJson.error) throw new Error(avJson.error);
        setAvailableSlots(avJson.data.available_slots);
      } catch (e) {
        setLoadError(e.message || "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  // 日付ごとにスロットをグループ化
  const groupedDates = useMemo(() => {
    const byDate = {};
    for (const utcISO of availableSlots) {
      const dateStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
      }).format(new Date(utcISO));
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(utcISO);
    }
    return Object.entries(byDate).map(([date, slots]) => ({
      date,
      label: formatDateLabel(date),
      slots,
    }));
  }, [availableSlots]);

  function handleDateClick(date) {
    setSelectedDate(date === selectedDate ? "" : date);
  }

  function handleSlotClick(utcISO) {
    setSelectedSlot(utcISO);
    setSubmitError("");
  }

  function handleBack() {
    setSelectedSlot("");
    setSubmitError("");
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setSubmitError("お名前を入力してください"); return; }
    if (!form.email.trim()) { setSubmitError("メールアドレスを入力してください"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setSubmitError("メールアドレスの形式が正しくありません");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/internal/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type_id: eventType.id,
          attendee_name: form.name.trim(),
          attendee_email: form.email.trim(),
          attendee_phone: form.phone.trim() || null,
          reason: form.reason.trim() || null,
          start_at: selectedSlot,
        }),
      });
      const json = await res.json();

      if (res.status === 409) {
        setSubmitError("この時間はすでに予約が入っています。別の時間を選択してください。");
        setSubmitting(false);
        return;
      }
      if (json.error) throw new Error(json.error);

      const { booking_id, start_at, cancel_token } = json.data;
      const params = new URLSearchParams({
        booking_id,
        start_at,
        name: form.name.trim(),
        cancel_token,
      });
      navigate(`/book/${slug}/confirm?${params.toString()}`);
    } catch (e) {
      setSubmitError(e.message || "予約の送信に失敗しました。もう一度お試しください。");
      setSubmitting(false);
    }
  }

  // ─── レンダリング ─────────────────────────────────────
  if (loading) return <div style={S.page}><div style={S.muted}>読み込み中...</div></div>;
  if (loadError) return <div style={S.page}><div style={{ ...S.muted, color: C.danger }}>{loadError}</div></div>;
  if (!eventType) return <div style={S.page}><div style={S.muted}>予約ページが見つかりません</div></div>;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* ヘッダー */}
        <div style={S.header}>
          <h1 style={S.title}>{eventType.name}</h1>
          {eventType.description && (
            <p style={S.desc}>{eventType.description}</p>
          )}
        </div>

        {/* ステップ1・2：日時選択 */}
        {!selectedSlot && (
          <div style={S.card}>
            <div style={S.sectionTitle}>日程・時間を選択してください</div>

            {groupedDates.length === 0 && (
              <div style={S.muted}>現在予約可能な日時がありません</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupedDates.map(({ date, label, slots }) => (
                <div key={date} style={S.dateRow(selectedDate === date)}>
                  <div
                    style={S.dateHeader}
                    onClick={() => handleDateClick(date)}
                  >
                    <span>{label}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>
                      {selectedDate === date ? "▲" : "▼"} {slots.length}件
                    </span>
                  </div>
                  {selectedDate === date && (
                    <div style={S.slotsGrid}>
                      {slots.map((utcISO) => (
                        <button
                          key={utcISO}
                          style={S.slotBtn}
                          onClick={() => handleSlotClick(utcISO)}
                        >
                          {formatTimeLabel(utcISO)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ステップ3：情報入力 */}
        {selectedSlot && (
          <div style={S.card}>
            <button style={S.backLink} onClick={handleBack}>
              ← 日時を変更する
            </button>
            <div style={S.selectedSlotTag}>
              {formatDateTimeLabel(selectedSlot)}（{eventType.duration_minutes}分）
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
              <div style={S.field}>
                <label style={S.label}>お名前 *</label>
                <input
                  style={S.input}
                  type="text"
                  placeholder="山田 太郎"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>メールアドレス *</label>
                <input
                  style={S.input}
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>電話番号（任意）</label>
                <input
                  style={S.input}
                  type="tel"
                  placeholder="090-0000-0000"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>ご相談内容（任意）</label>
                <textarea
                  style={S.textarea}
                  placeholder="相談したい内容があればご記入ください"
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>

              {submitError && <div style={S.error}>{submitError}</div>}

              <button
                style={{
                  ...S.primaryBtn,
                  opacity: submitting ? 0.6 : 1,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "送信中..." : "予約を確定する"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
