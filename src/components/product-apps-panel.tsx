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

  async function toggle(app: ProductApp) {
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
      setApps((prev) => prev.map((item) => (item.id === app.id ? data.app! : item)));
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
          apps.map((app) => (
            <article key={app.id} className="surface rounded-[28px] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{app.name}</h3>
                  <p className="mt-1 font-mono text-sm text-[var(--muted)]">
                    client_id = {app.clientId}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary min-h-10 px-3"
                  onClick={() => toggle(app)}
                >
                  {app.enabled ? "停用" : "启用"}
                </button>
              </div>
              {app.homepageUrl ? (
                <p className="mt-2 break-all text-sm">{app.homepageUrl}</p>
              ) : null}
              <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                {app.redirectUris.map((uri) => (
                  <li key={uri} className="break-all">
                    回调 {uri}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
