"use client";

import { useState } from "react";

type Settings = {
  siteUrl: string;
  wechatAppId: string;
  wechatAppSecret: string;
  wechatWebAppId: string;
  wechatWebAppSecret: string;
  wechatMobileAppId: string;
  wechatMobileAppSecret: string;
  smsEnabled: boolean;
  smsProvider: string;
  smsAccessKeyId: string;
  smsAccessKeySecret: string;
  smsSignName: string;
  smsTemplateCode: string;
  smsTestMode: boolean;
  smsTestFixedCode: string;
};

export function AuthSettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/studio/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; settings?: Settings };
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      if (data.settings) setForm((prev) => ({ ...prev, ...data.settings }));
      setNotice("已保存");
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="surface space-y-3 rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">站点</h2>
        <label className="block text-sm">
          公网地址
          <input
            className="field mt-1"
            value={form.siteUrl}
            onChange={(e) => set("siteUrl", e.target.value)}
            placeholder="https://example.com"
          />
        </label>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">短信登录</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.smsEnabled}
            onChange={(e) => set("smsEnabled", e.target.checked)}
          />
          启用手机号验证码登录
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.smsTestMode}
            onChange={(e) => set("smsTestMode", e.target.checked)}
          />
          测试模式（验证码写日志，可用固定码）
        </label>
        <label className="block text-sm">
          测试固定验证码
          <input
            className="field mt-1"
            value={form.smsTestFixedCode}
            onChange={(e) => set("smsTestFixedCode", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          阿里云 AccessKeyId
          <input
            className="field mt-1"
            value={form.smsAccessKeyId}
            onChange={(e) => set("smsAccessKeyId", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          阿里云 AccessKeySecret
          <input
            className="field mt-1"
            value={form.smsAccessKeySecret}
            onChange={(e) => set("smsAccessKeySecret", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          短信签名
          <input
            className="field mt-1"
            value={form.smsSignName}
            onChange={(e) => set("smsSignName", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          模板 CODE
          <input
            className="field mt-1"
            value={form.smsTemplateCode}
            onChange={(e) => set("smsTemplateCode", e.target.value)}
          />
        </label>
      </section>

      <section className="surface space-y-3 rounded-[28px] p-5">
        <h2 className="text-lg font-semibold">微信授权</h2>
        <label className="block text-sm">
          公众号 AppID
          <input
            className="field mt-1"
            value={form.wechatAppId}
            onChange={(e) => set("wechatAppId", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          公众号 AppSecret
          <input
            className="field mt-1"
            value={form.wechatAppSecret}
            onChange={(e) => set("wechatAppSecret", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          网站应用 AppID
          <input
            className="field mt-1"
            value={form.wechatWebAppId}
            onChange={(e) => set("wechatWebAppId", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          网站应用 AppSecret
          <input
            className="field mt-1"
            value={form.wechatWebAppSecret}
            onChange={(e) => set("wechatWebAppSecret", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          移动应用 AppID
          <input
            className="field mt-1"
            value={form.wechatMobileAppId}
            onChange={(e) => set("wechatMobileAppId", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          移动应用 AppSecret
          <input
            className="field mt-1"
            value={form.wechatMobileAppSecret}
            onChange={(e) => set("wechatMobileAppSecret", e.target.value)}
          />
        </label>
      </section>

      {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}
      {notice ? <p className="text-sm text-[var(--brand)]">{notice}</p> : null}
      <button type="submit" className="btn btn-primary min-h-11 px-5" disabled={saving}>
        {saving ? "保存中…" : "保存设置"}
      </button>
    </form>
  );
}
