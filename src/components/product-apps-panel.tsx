"use client";

import { useState } from "react";

export type ProductApp = {
  id: string;
  clientId: string;
  name: string;
  homepageUrl: string;
  redirectUris: string[];
  enabled: boolean;
};

type EditDraft = {
  name: string;
  homepageUrl: string;
  redirectUris: string;
};

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        enabled
          ? "bg-[var(--brand)]/12 text-[var(--brand)]"
          : "bg-[var(--line)]/60 text-[var(--muted)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          enabled ? "bg-[var(--brand)]" : "bg-[var(--muted)]"
        }`}
        aria-hidden
      />
      {enabled ? "已启用" : "已停用"}
    </span>
  );
}

export function ProductAppsPanel({ initialApps }: { initialApps: ProductApp[] }) {
  const [apps, setApps] = useState(initialApps);
  const [name, setName] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newSecret, setNewSecret] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function createApp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setNewSecret("");
    try {
      const res = await fetch("/api/studio/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          homepageUrl,
          clientId: clientId || undefined,
          redirectUris: redirectUris
            .split(/\n+/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        app?: ProductApp;
        clientSecret?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || "创建失败");
        return;
      }
      if (data.app) setApps((prev) => [...prev, data.app!]);
      setNewSecret(data.clientSecret || "");
      setNotice(data.message || "已创建");
      setName("");
      setHomepageUrl("");
      setRedirectUris("");
      setClientId("");
    } catch {
      setError("创建失败");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(app: ProductApp) {
    setEditingId(app.id);
    setDraft({
      name: app.name,
      homepageUrl: app.homepageUrl || "",
      redirectUris: app.redirectUris.join("\n"),
    });
    setEditError("");
    setLastSavedId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEditError("");
  }

  async function saveEdit(app: ProductApp) {
    if (!draft) return;
    setEditSaving(true);
    setEditError("");
    try {
      const uris = draft.redirectUris
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean);
      const res = await fetch("/api/studio/apps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: app.id,
          name: draft.name.trim(),
          homepageUrl: draft.homepageUrl.trim(),
          redirectUris: uris,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        app?: ProductApp;
        message?: string;
        clientSecret?: string;
      };
      if (!res.ok) {
        setEditError(data.error || "保存失败");
        return;
      }
      if (data.app) {
        setApps((prev) =>
          prev.map((item) => (item.id === app.id ? { ...item, ...data.app! } : item)),
        );
      }
      setEditingId(null);
      setDraft(null);
      setLastSavedId(app.id);
      setNotice(data.message || "保存成功");
    } catch {
      setEditError("保存失败");
    } finally {
      setEditSaving(false);
    }
  }

  async function toggle(app: ProductApp) {
    setTogglingId(app.id);
    setError("");
    try {
      const res = await fetch("/api/studio/apps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, enabled: !app.enabled }),
      });
      const data = (await res.json()) as { app?: ProductApp; error?: string };
      if (!res.ok) {
        setError(data.error || "更新失败");
        return;
      }
      if (data.app) {
        setApps((prev) =>
          prev.map((item) => (item.id === app.id ? { ...item, ...data.app! } : item)),
        );
      }
    } catch {
      setError("更新失败");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createApp} className="surface space-y-3 rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">接入新产品</h2>
        <p className="text-sm text-[var(--muted)]">
          登记后，该软件登录时跳到账号中心，用户用同一套账号密码进入。
        </p>
        <label className="block text-sm">
          产品名称
          <input
            className="field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="文档 / 商城 / 论坛"
            required
          />
        </label>
        <label className="block text-sm">
          产品 ID（可选，英文）
          <input
            className="field mt-1"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="docs"
          />
        </label>
        <label className="block text-sm">
          产品首页
          <input
            className="field mt-1"
            value={homepageUrl}
            onChange={(e) => setHomepageUrl(e.target.value)}
            placeholder="https://docs.example.com"
          />
        </label>
        <label className="block text-sm">
          登录回调地址（每行一个，须精确匹配）
          <textarea
            className="field mt-1 min-h-24"
            value={redirectUris}
            onChange={(e) => setRedirectUris(e.target.value)}
            placeholder="https://docs.example.com/auth/callback"
            required
          />
        </label>
        {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}
        {notice ? <p className="text-sm text-[var(--brand)]">{notice}</p> : null}
        {newSecret ? (
          <p className="break-all rounded-2xl bg-[var(--brand-soft)] p-3 text-sm">
            client_secret：<code>{newSecret}</code>
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary min-h-11 px-4" disabled={saving}>
          {saving ? "创建中…" : "登记产品"}
        </button>
      </form>

      <section className="space-y-3">
        {apps.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">还没有接入的软件产品。</p>
        ) : (
          apps.map((app) => {
            const isEditing = editingId === app.id && draft;
            const enableTitle = app.enabled
              ? "当前状态：已启用。点击后将停用该产品的登录接入。"
              : "当前状态：已停用。点击后将重新启用该产品的登录接入。";

            return (
              <article key={app.id} className="surface rounded-[28px] p-5">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">修改产品</h3>
                      <StatusBadge enabled={app.enabled} />
                    </div>
                    <label className="block text-sm">
                      产品名称
                      <input
                        className="field mt-1"
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="block text-sm">
                      产品 ID（client_id，不可修改）
                      <input
                        className="field mt-1 bg-[var(--bg-deep)] text-[var(--muted)]"
                        value={app.clientId}
                        readOnly
                        aria-readonly="true"
                      />
                    </label>
                    <label className="block text-sm">
                      产品首页
                      <input
                        className="field mt-1"
                        value={draft.homepageUrl}
                        onChange={(e) =>
                          setDraft({ ...draft, homepageUrl: e.target.value })
                        }
                        placeholder="https://www.example.com/products/days"
                      />
                    </label>
                    <label className="block text-sm">
                      登录回调地址（每行一个，须精确匹配）
                      <textarea
                        className="field mt-1 min-h-24"
                        value={draft.redirectUris}
                        onChange={(e) =>
                          setDraft({ ...draft, redirectUris: e.target.value })
                        }
                        required
                      />
                    </label>
                    {editError ? (
                      <p className="text-sm text-[var(--fire)]">{editError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary min-h-10 px-4"
                        disabled={editSaving}
                        onClick={() => saveEdit(app)}
                      >
                        {editSaving ? "保存中…" : "保存"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-10 px-4"
                        disabled={editSaving}
                        onClick={cancelEdit}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{app.name}</h3>
                          <StatusBadge enabled={app.enabled} />
                        </div>
                        <p className="font-mono text-sm text-[var(--muted)]">
                          client_id = {app.clientId}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary min-h-10 px-3"
                          onClick={() => startEdit(app)}
                          disabled={togglingId === app.id}
                        >
                          修改
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary min-h-10 px-3"
                          onClick={() => toggle(app)}
                          disabled={togglingId === app.id || editingId !== null}
                          title={enableTitle}
                          aria-label={enableTitle}
                        >
                          {togglingId === app.id
                            ? "处理中…"
                            : app.enabled
                              ? "停用"
                              : "启用"}
                        </button>
                      </div>
                    </div>
                    {app.homepageUrl ? (
                      <p className="mt-2 break-all text-sm">{app.homepageUrl}</p>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">未设置产品首页</p>
                    )}
                    <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                      {app.redirectUris.map((uri) => (
                        <li key={uri} className="break-all">
                          回调 {uri}
                        </li>
                      ))}
                    </ul>
                    {lastSavedId === app.id ? (
                      <p className="mt-2 text-sm text-[var(--brand)]">保存成功</p>
                    ) : null}
                  </>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
