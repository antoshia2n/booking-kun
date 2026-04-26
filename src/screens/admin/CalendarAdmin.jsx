import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthUid } from "shia2n-core";

const C = {
  bg: "#f5f5f3", surface: "#ffffff", text: "#111110",
  muted: "#888", border: "#e5e5e4", primary: "#2563eb",
  danger: "#dc2626", dangerBg: "#fef2f2", dangerBorder: "#fecaca",
  success: "#16a34a", successBg: "#f0fdf4", successBorder: "#bbf7d0",
};

const S = {
  page: {
    minHeight: "100vh", background: C.bg, padding: "24px 16px 48px",
    fontFamily: "'Hiragino Sans', 'Noto Sans JP', 'YuGothic', sans-serif",
  },
  container: { width: "100%", maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  nav: { display: "flex", gap: 16, alignItems: "center", marginBottom: 4 },
  navLink: { fontSize: 12, color: C.muted, textDecoration: "none" },
  h1: { fontSize: 18, fontWeight: 700, color: C.text, margin: 0 },
  primaryBtn: {
    padding: "10px 16px", borderRadius: 8, border: "none",
    background: C.primary, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  dangerBtn: {
    padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.dangerBorder}`,
    background: C.dangerBg, color: C.danger, fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  ghostBtn: {
    padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
    background: C.surface, color: C.muted, fontSize: 12, cursor: "pointer",
  },
  card: {
    background: C.surface, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`,
    display: "flex", flexDirection: "column", gap: 12,
  },
  label: { fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" },
  value: { fontSize: 14, fontWeight: 600, color: C.text },
  input: {
    padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
    background: C.surface, fontSize: 13, color: C.text, outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "inherit",
  },
  select: {
    padding: "8px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
    background: C.surface, fontSize: 13, color: C.text, outline: "none",
    width: "100%", fontFamily: "inherit",
  },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  toast: (type) => ({
    padding: "10px 14px", borderRadius: 8, fontSize: 13,
    background: type === "success" ? C.successBg : C.dangerBg,
    border: `1px solid ${type === "success" ? C.successBorder : C.dangerBorder}`,
    color: type === "success" ? C.success : C.danger,
  }),
  badge: (active) => ({
    padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
    background: active ? C.successBg : "#f3f4f6",
    color: active ? C.success : C.muted,
    border: `1px solid ${active ? C.successBorder : C.border}`,
  }),
};

function apiHeaders(uid) {
  return { "Content-Type": "application/json", "X-User-Id": uid };
}

function CredentialCard({ cred, uid, onUpdated }) {
  const [displayName, setDisplayName] = useState(cred.display_name || "");
  const [calendars,   setCalendars]   = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [revoking,    setRevoking]    = useState(false);
  const [calError,    setCalError]    = useState("");

  const isExpired = new Date(cred.expires_at) < new Date();

  async function loadCalendars() {
    if (calendars !== null) return;
    setCalError("");
    try {
      const res  = await fetch(`/api/internal/list-calendars?credential_id=${cred.id}`, { headers: apiHeaders(uid) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCalendars(json.data);
    } catch (e) {
      setCalError(e.message);
    }
  }

  async function save(fields) {
    setSaving(true);
    try {
      const res = await fetch("/api/internal/update-calendar-credential", {
        method: "POST",
        headers: apiHeaders(uid),
        body: JSON.stringify({ credential_id: cred.id, ...fields }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      onUpdated();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    if (!confirm(`${cred.google_email} の連携を解除しますか？`)) return;
    setRevoking(true);
    try {
      const res = await fetch("/api/internal/revoke-calendar-credential", {
        method: "POST",
        headers: apiHeaders(uid),
        body: JSON.stringify({ credential_id: cred.id }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      onUpdated();
    } catch (e) {
      alert(e.message);
      setRevoking(false);
    }
  }

  return (
    <div style={{ ...S.card, opacity: cred.active ? 1 : 0.6 }}>
      <div style={S.row}>
        <div style={{ flex: 1 }}>
          <div style={S.label}>Google アカウント</div>
          <div style={S.value}>{cred.google_email}</div>
        </div>
        <span style={S.badge(cred.active)}>{cred.active ? "有効" : "解除済み"}</span>
        {isExpired && <span style={S.badge(false)}>トークン期限切れ</span>}
      </div>

      {cred.active && (
        <>
          <div>
            <div style={S.label}>表示名</div>
            <div style={S.row}>
              <input
                style={{ ...S.input, flex: 1 }}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例：仕事用"
              />
              <button style={S.ghostBtn} onClick={() => save({ display_name: displayName })} disabled={saving}>
                {saving ? "保存中" : "保存"}
              </button>
            </div>
          </div>

          <div>
            <div style={S.label}>プライマリカレンダー</div>
            {calendars === null ? (
              <button style={S.ghostBtn} onClick={loadCalendars}>カレンダー一覧を読み込む</button>
            ) : calError ? (
              <div style={{ fontSize: 12, color: C.danger }}>{calError}</div>
            ) : (
              <select
                style={S.select}
                value={cred.primary_calendar_id || ""}
                onChange={(e) => save({ primary_calendar_id: e.target.value || null })}
              >
                <option value="">選択してください</option>
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.summary}{cal.primary ? "（プライマリ）" : ""}
                  </option>
                ))}
              </select>
            )}
            {cred.primary_calendar_id && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                設定済み: {cred.primary_calendar_id}
              </div>
            )}
          </div>

          <div style={S.row}>
            <button style={S.dangerBtn} onClick={revoke} disabled={revoking}>
              {revoking ? "処理中..." : "連携を解除"}
            </button>
            <div style={{ fontSize: 11, color: C.muted }}>
              連携日: {new Date(cred.created_at).toLocaleDateString("ja-JP")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function CalendarAdmin() {
  const uid                   = useAuthUid();
  const [searchParams]        = useSearchParams();
  const [creds,   setCreds]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  const connectedEmail = searchParams.get("connected");
  const errorMsg       = searchParams.get("error");

  useEffect(() => {
    if (connectedEmail) setToast({ type: "success", msg: `${connectedEmail} を連携しました` });
    if (errorMsg)       setToast({ type: "error",   msg: errorMsg });
  }, [connectedEmail, errorMsg]);

  const loadCreds = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/internal/list-calendar-credentials?user_id=${uid}`, { headers: apiHeaders(uid) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCreds(json.data);
    } catch (e) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { loadCreds(); }, [loadCreds]);

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* ナビゲーション */}
        <nav style={S.nav}>
          <a href="/" style={S.navLink}>← ホーム</a>
          <a href="/admin/event-types" style={S.navLink}>予約タイプ管理</a>
        </nav>

        <div style={S.row}>
          <h1 style={{ ...S.h1, flex: 1 }}>連携カレンダー</h1>
          <a href="/api/calendar/oauth-start" style={{ textDecoration: "none" }}>
            <button style={S.primaryBtn}>+ Googleアカウントを連携</button>
          </a>
        </div>

        {toast && (
          <div style={S.toast(toast.type)}>
            {toast.msg}
            <button
              onClick={() => setToast(null)}
              style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            >
              ✕
            </button>
          </div>
        )}

        {loading && <div style={{ fontSize: 13, color: C.muted }}>読み込み中...</div>}

        {!loading && creds.length === 0 && (
          <div style={{ ...S.card, color: C.muted, fontSize: 13 }}>
            まだ連携されていません。「+ Googleアカウントを連携」から追加してください。
          </div>
        )}

        {creds.map((cred) => (
          <CredentialCard key={cred.id} cred={cred} uid={uid} onUpdated={loadCreds} />
        ))}
      </div>
    </div>
  );
}
