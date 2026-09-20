"use client";

/**
 * 安全中心：登录设备、登录记录、安全事件。
 * 退出某台设备时，该设备授权给各产品的令牌会一起失效。
 */

import { useEffect, useState } from "react";

type SessionRow = {
  id: string;
  device: string;
  ip: string;
  method: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
};

type LoginRow = {
  id: string;
  method: string;
  success: boolean;
  reason: string;
  ip: string;
  device: string;
  createdAt: string;
};

type EventRow = {
  id: string;
  type: string;
  detail: string;
  ip: string;
  createdAt: string;
};

const METHOD_LABEL: Record<string, string> = {
  password: "密码",
  sms: "短信验证码",
  wechat: "微信",
  oauth: "产品授权",
  sso: "主站同步登录",
};

const EVENT_LABEL: Record<string, string> = {
  password_changed: "修改密码",
  session_revoked: "退出设备",
  sessions_revoked_all: "退出其他设备",
  email_changed: "更换邮箱",
  phone_bound: "绑定手机号",
  username_changed: "更换自设账号",
  client_authorized: "授权产品登录",
  client_secret_rotated: "重置产品密钥",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("zh-CN");
}

export function AccountSecurityPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function apply(data: {
    error?: string;
    sessions?: SessionRow[];
    logins?: LoginRow[];
    events?: EventRow[];
  }) {
    setLoading(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    setSessions(data.sessions || []);
    setLogins(data.logins || []);
    setEvents(data.events || []);
  }

  function load() {
    return fetch("/api/account/sessions")
      .then((res) => res.json())
      .then(apply)
      .catch(() => apply({ error: "读取失败" }));
  }

  useEffect(() => {
    void load();
    // 只在挂载时拉一次；后续由各操作手动刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function revokeOne(id: string, current: boolean) {
    setBusy(id);
    setError("");
    setNotice("");
    const res = await fetch(`/api/account/sessions/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(data.error || "退出失败");
      return;
    }
    if (current) {
      window.location.assign("/login");
      return;
    }
    setNotice("已退出该设备");
    void load();
  }

  async function revokeOthers() {
    setBusy("others");
    setError("");
    setNotice("");
    const res = await fetch("/api/account/sessions", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(data.error || "退出失败");
      return;
    }
    setNotice(
      data.revoked > 0 ? `已退出其他 ${data.revoked} 台设备` : "没有其他设备",
    );
    void load();
  }

  return (
    <div className="space-y-6">
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">登录设备</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              退出某台设备后，它在各个产品里的登录也会随之失效。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3"
            disabled={busy === "others" || sessions.length <= 1}
            onClick={() => void revokeOthers()}
          >
            {busy === "others" ? "处理中…" : "退出其他设备"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">加载中…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              没有可管理的设备。主站同步过来的登录态不在这里列出。
            </p>
          ) : (
            sessions.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {row.device}
                    {row.current ? (
                      <span className="ml-2 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-xs text-[var(--brand)]">
                        当前设备
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {METHOD_LABEL[row.method] || row.method} · IP {row.ip || "未知"}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    最近活跃 {when(row.lastSeenAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary min-h-10 shrink-0 px-3 text-sm"
                  disabled={busy === row.id}
                  onClick={() => void revokeOne(row.id, row.current)}
                >
                  {busy === row.id ? "处理中…" : row.current ? "退出登录" : "退出"}
                </button>
              </div>
            ))
          )}
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {notice ? (
          <p className="mt-3 text-sm text-[var(--brand-strong)]">{notice}</p>
        ) : null}
      </section>

      <section className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">登录记录</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          最近 20 次登录尝试，失败的也会记下来。看到不认识的记录请立刻改密码。
        </p>
        <div className="mt-4 space-y-2">
          {logins.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">暂无记录</p>
          ) : (
            logins.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm"
              >
                <span>
                  {METHOD_LABEL[row.method] || row.method}
                  <span
                    className={
                      row.success
                        ? "ml-2 text-xs text-[var(--brand-strong)]"
                        : "ml-2 text-xs text-red-700"
                    }
                  >
                    {row.success ? "成功" : `失败${row.reason ? ` · ${row.reason}` : ""}`}
                  </span>
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {row.device} · {row.ip || "未知"} · {when(row.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="surface rounded-[28px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold">安全事件</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          改密码、退出设备、授权产品登录等操作都会记录。
        </p>
        <div className="mt-4 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">暂无记录</p>
          ) : (
            events.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-4 py-2.5 text-sm"
              >
                <span>
                  {EVENT_LABEL[row.type] || row.type}
                  {row.detail ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      {row.detail}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {when(row.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
