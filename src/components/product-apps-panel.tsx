"use client";

import { useState } from "react";
import { oneTimeClientSecret } from "@/helpers/one-time-client-secret";
import { OneTimeSecretPanel, type RevealedSecret } from "./one-time-secret-panel";

export type ProductApp = {
  id: string;
  clientId: string;
  clientType?: string;
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
  const [rotatingId, setRotatingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);

  function revealSecret(app: ProductApp | undefined, secret: string | undefined) {
    const plaintext = oneTimeClientSecret(app?.clientType, secret);
    if (!plaintext || !app?.clientId) {
      setRevealed(null);
      return;
    }
    setRevealed({ clientId: app.clientId, clientSecret: plaintext });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function createApp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setRevealed(null);
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
      revealSecret(data.app, data.clientSecret);
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

  async function rotateSecret(app: ProductApp) {
    if (!window.confirm(`重新生成 ${app.clientId} 的密钥？旧密钥立刻失效。`)) return;
    setError("");
    setNotice("");
    setRevealed(null);
    setRotatingId(app.id);
    try {
      const res = await fetch("/api/studio/apps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, rotateSecret: true }),
      });
      const data = (await res.json()) as {
        app?: ProductApp;
        clientSecret?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "生成密钥失败");
        return;
      }
      revealSecret(data.app || app, data.clientSecret);
      setNotice(data.message || "新密钥已生成，请立刻保存");
    } catch {
      setError("生成密钥失败");
    } finally {
      setRotatingId("");
    }
  }

  return (
    <div className="space-y-6">
      {revealed ? (
        <OneTimeSecretPanel revealed={revealed} onDismiss={() => setRevealed(null)} />
      ) : null}
      <form onSubmit={createApp} className="surface space-y-3 rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">接入新产品</h2>
        <p className="text-sm text-[var(--muted)]">
          登记后，该软件登录时跳到账号中心，用户用同一套账号密码进入。confidential
          产品创建成功会立刻弹出本次密钥，只显示这一次。
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
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    密钥只存哈希，列表里永远看不到明文。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {app.clientType === "public" ? null : (
                    <button
                      type="button"
                      className="btn btn-secondary min-h-10 px-3"
                      disabled={rotatingId === app.id}
                      onClick={() => void rotateSecret(app)}
                    >
                      {rotatingId === app.id ? "生成中…" : "重新生成密钥"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary min-h-10 px-3"
                    onClick={() => toggle(app)}
                  >
                    {app.enabled ? "停用" : "启用"}
                  </button>
                </div>
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
