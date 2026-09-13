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
  smsAliyunReady?: boolean;
  smsEnvConfigured?: boolean;
};

export function AuthSettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testingSms, setTestingSms] = useState(false);

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

  async function sendTestSms() {
    setTestingSms(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/studio/settings/sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error || "试发失败");
        return;
      }
      setNotice(data.message || "已发送");
    } catch {
      setError("试发失败");
    } finally {
      setTestingSms(false);
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
        <h2 className="text-lg font-semibold">手机号验证码</h2>
        <p className="text-sm text-[var(--muted)]">
          用户填写手机号后收取 6 位验证码，即可注册、登录，或在个人中心绑定到已有账号。关闭测试模式并填好 AccessKey 后，验证码会发到手机。
        </p>
        <p className="rounded-2xl bg-[var(--bg-deep)]/50 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          阿里云国内短信已过审：签名「歪歪滴艾斯杭州科技」，注册登录模板
          SMS_512395568，备用验证码模板 SMS_338610504。下面签名和模板已按过审项填好，一般只需再填
          AccessKey，关掉测试模式。
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.smsEnabled}
            onChange={(e) => set("smsEnabled", e.target.checked)}
          />
          启用手机号验证码登录 / 注册
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">验证码怎么发</legend>
          <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-2xl border border-[var(--line)] px-3 py-3 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={form.smsTestMode}
              onChange={() => set("smsTestMode", true)}
            />
            <span>
              测试模式（不发短信）
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                验证码写服务器日志，也可用下面的固定码联调。
              </span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-2xl border border-[var(--line)] px-3 py-3 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={!form.smsTestMode}
              onChange={() => set("smsTestMode", false)}
            />
            <span>
              发送到用户手机（阿里云短信）
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                模板内容需包含变量 code，例如「您的验证码为 {'${code}'}」。
              </span>
            </span>
          </label>
        </fieldset>
        {form.smsTestMode ? (
          <label className="block text-sm">
            测试固定验证码
            <input
              className="field mt-1"
              value={form.smsTestFixedCode}
              onChange={(e) => set("smsTestFixedCode", e.target.value)}
              placeholder="123456"
            />
          </label>
        ) : null}
        {form.smsEnvConfigured ? (
          <p className="text-xs text-[var(--muted)]">
            已从环境变量读到部分阿里云参数，页面里留空的项会用 .env 补齐。
          </p>
        ) : null}
        {!form.smsAliyunReady ? (
          <p className="text-sm text-amber-800">
            还缺阿里云 AccessKey。到 RAM 用户里建一对 AccessKey，把 Id 和
            Secret 填在下面，保存后再关掉测试模式，验证码才会发到手机。
          </p>
        ) : null}
        <label className="block text-sm">
          阿里云 AccessKeyId
          <input
            className="field mt-1"
            value={form.smsAccessKeyId}
            onChange={(e) => set("smsAccessKeyId", e.target.value)}
            placeholder="LTAI..."
          />
        </label>
        <label className="block text-sm">
          阿里云 AccessKeySecret
          <input
            className="field mt-1"
            value={form.smsAccessKeySecret}
            onChange={(e) => set("smsAccessKeySecret", e.target.value)}
            placeholder="保存后只显示打码"
          />
        </label>
        <label className="block text-sm">
          短信签名
          <input
            className="field mt-1"
            value={form.smsSignName}
            onChange={(e) => set("smsSignName", e.target.value)}
            placeholder="歪歪滴艾斯杭州科技"
          />
        </label>
        <label className="block text-sm">
          模板 CODE
          <input
            className="field mt-1"
            value={form.smsTemplateCode}
            onChange={(e) => set("smsTemplateCode", e.target.value)}
            placeholder="SMS_512395568"
          />
        </label>
        <div className="rounded-2xl bg-[var(--bg-deep)]/50 p-3">
          <p className="text-sm font-medium">试发到手机</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            保存设置后，用自己的手机号测一次。测试模式不会真发短信。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="field min-w-0 flex-1"
              type="tel"
              inputMode="numeric"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="11 位手机号"
            />
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-3"
              disabled={testingSms || !testPhone.trim()}
              onClick={() => void sendTestSms()}
            >
              {testingSms ? "发送中…" : "试发验证码"}
            </button>
          </div>
        </div>
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
