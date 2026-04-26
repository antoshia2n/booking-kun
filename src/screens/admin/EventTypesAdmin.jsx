import { useState, useEffect } from "react";
import { useAuthUid } from "shia2n-core";

const C = {
  bg: "#f5f5f3", surface: "#ffffff", text: "#111110",
  muted: "#888", border: "#e5e5e4", primary: "#2563eb",
  success: "#16a34a", successBg: "#f0fdf4", successBorder: "#bbf7d0",
};

const S = {
  page: {
    minHeight: "100vh", background: C.bg, padding: "24px 16px 48px",
    fontFamily: "'Hiragino Sans', 'Noto Sans JP', 'YuGothic', sans-serif",
  },
  container: { width: "100%", maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  h1: { fontSize: 18, fontWeight: 700, color: C.text, margin: 0 },
  card: {
    background: C.surface, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`,
    display: "flex", flexDirection: "column", gap: 14,
  },
  label: { fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" },
  value: { fontSize: 14, fontWeight: 600, color: C.text },
  select: {
    padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
    background: C.surface, fontSize: 13, color: C.text, outline: "none",
    width: "100%", fontFamily: "inherit",
  },
  row: { display: "flex", gap: 8, alignItems: "center" },
  saveBtn: {
    padding: "10px 0", borderRadius: 8, border: "none",
    background: C.primary, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
  },
  toggle: (on) => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "6px 12px", borderRadius: 6, cursor: "pointer",
    border: `1px solid ${on ? C.primary : C.border}`,
    background: on ? "#eff6ff" : C.surface,
    color: on ? C.primary : C.muted,
    fontSize: 13, fontWeight: 600, userSelect: "none",
  }),
  toast: {
    padding: "10px 14px", borderRadius: 8, fontSize: 13,
    background: C.successBg, border: `1px solid ${C.successBorder}`, color: C.success,
  },
  muted: { fontSize: 12, color: C.muted },
};

function apiHeaders(uid) {
  return { "Content-Type": "application/json", "X-User-Id": uid };
}

function EventTypeCard({ et, creds, uid, onSaved }) {
  const [useCalendar, setUseCalendar] = useState(et.use_calendar || false);
  const [credId,      setCredId]      = useState(et.calendar_credential_id || "");
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const body = {
        event_type_id:         et.id,
        use_calendar:          useCalendar,
        calendar_credential_id: useCalendar && credId ? credId : null,
      };
      const res  = await fetch("/api/internal/update-event-type", {
        method: "POST",
        headers: apiHeaders(uid),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  const activeCreds = (creds || []).filter((c) => c.active);

  return (
    <div style={S.card}>
      <div>
        <div style={S.label}>予約タイプ</div>
        <div style={S.value}>{et.name}</div>
        <div style={{ ...S.muted, marginTop: 2 }}>{et.slug} / {et.duration_minutes}分</div>
      </div>

      <div>
        <div style={S.label}>Googleカレンダー連携</div>
        <div
          style={S.toggle(useCalendar)}
          onClick={() => {
            setUseCalendar((v) => !v);
            if (useCalendar) setCredId("");
          }}
        >
          {useCalendar ? "ON（連携する）" : "OFF（固定スロットのみ）"}
        </div>
      </div>

      {useCalendar && (
        <div>
          <div style={S.label}>連携アカウント</div>
          {activeCreds.length === 0 ? (
            <div style={S.muted}>
              連携アカウントがありません。
              <a href="/admin/calendar" style={{ color: C.primary }}>カレンダー管理</a>
              から先に連携してください。
            </div>
          ) : (
            <select
              style={S.select}
              value={credId}
              onChange={(e) => setCredId(e.target.value)}
            >
              <option value="">アカウントを選択</option>
              {activeCreds.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name ? `${c.display_name}（${c.google_email}）` : c.google_email}
                </option>
              ))}
            </select>
          )}
          {credId && (
            <div style={{ ...S.muted, marginTop: 4 }}>
              空き時間取得・イベント作成に使用します。プライマリカレンダーは「連携カレンダー」画面で設定してください。
            </div>
          )}
        </div>
      )}

      <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
        {saving ? "保存中..." : saved ? "保存しました ✓" : "設定を保存"}
      </button>
    </div>
  );
}

export default function EventTypesAdmin() {
  const uid                       = useAuthUid();
  const [eventTypes, setEventTypes] = useState([]);
  const [creds,      setCreds]     = useState([]);
  const [loading,    setLoading]   = useState(true);

  async function loadAll() {
    if (!uid) return;
    try {
      const [etRes, credRes] = await Promise.all([
        fetch(`/api/internal/list-event-types?user_id=${uid}`, { headers: { "X-User-Id": uid } }),
        fetch(`/api/internal/list-calendar-credentials?user_id=${uid}`, { headers: { "X-User-Id": uid } }),
      ]);
      const etJson   = await etRes.json();
      const credJson = await credRes.json();
      if (etJson.data)   setEventTypes(etJson.data);
      if (credJson.data) setCreds(credJson.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [uid]);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.h1}>予約タイプ管理</h1>

        {loading && <div style={{ fontSize: 13, color: C.muted }}>読み込み中...</div>}

        {!loading && eventTypes.length === 0 && (
          <div style={{ fontSize: 13, color: C.muted }}>予約タイプがありません</div>
        )}

        {eventTypes.map((et) => (
          <EventTypeCard key={et.id} et={et} creds={creds} uid={uid} onSaved={loadAll} />
        ))}
      </div>
    </div>
  );
}
