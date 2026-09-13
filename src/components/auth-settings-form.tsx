"use client";

import { useState } from "react";
import {
  postSave,
  SaveFeedback,
  type SaveStatus,
} from "@/components/save-feedback";

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
  smsTemplateCodeLogin: string;
  smsTemplateCodeRegister: string;
  smsTemplateCodeBind: string;
  smsTestMode: boolean;
  smsTestFixedCode: string;
  smsAliyunReady?: boolean;
  smsEnvConfigured?: boolean;
};

type Section = "site" | "sms" | "wechat";

const SMS_KEYS = [
  "smsEnabled",
  "smsTestMode",
  "smsAccessKeyId",
  "smsAccessKeySecret",
  "smsSignName",
  "smsTemplateCodeLogin",
  "smsTemplateCodeRegister",
  "smsTemplateCodeBind",
  "smsTestFixedCode",
] as const;

const SITE_KEYS = ["siteUrl"] as const;

const WECHAT_KEYS = [
  "wechatAppId",
  "wechatAppSecret",
  "wechatWebAppId",
  "wechatWebAppSecret",
  "wechatMobileAppId",
  "wechatMobileAppSecret",
] as const;

function pick<K extends keyof Settings>(form: Settings, keys: readonly K[]) {
  const out = {} as Pick<Settings, K>;
  for (const key of keys) out[key] = form[key];
  return out;
}

function SectionSaveBar({
  saving,
  status,
  label,
}: {
  saving: boolean;
  status: SaveStatus;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <button type="submit" className="btn btn-primary min-h-11 px-5" disabled={saving}>
        {saving ? "保存中…" : label}
      </button>
      <SaveFeedback status={status} />
    </div>
  );
}

/** Each settings card is its own form with a dedicated save button. Add new cards the same way. */
export function AuthSettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState<Section | null>(null);
  const [status, setStatus] = useState<Record<Section, SaveStatus>>({
    site: null,
    sms: null,
    wechat: null,
  });
  const [testPhone, setTestPhone] = useState("");
  const [testPurpose, setTestPurpose] = useState<
    "login" | "register" | "bind"
  >("login");
  const [testingSms, setTestingSms] = useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSection(
    section: Section,
    payload: Partial<Settings>,
    okText: string,
  ) {
    setSaving(section);
    setStatus((prev) => ({ ...prev, [section]: null }));
    const result = await postSave("/api/studio/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(null);
    if (!result.ok) {
      setStatus((prev) => ({
        ...prev,
        [section]: { kind: "error", text: result.error },
      }));
      return;
    }
    const next = result.data.settings as Settings | undefined;
    if (next) setForm((prev) => ({ ...prev, ...next }));
    setStatus((prev) => ({
      ...prev,
      [section]: { kind: "ok", text: okText },
    }));
  }

  async function sendTestSms() {
    setTestingSms(true);
    setStatus((prev) => ({ ...prev, sms: null }));
    const result = await postSave("/api/studio/settings/sms-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, purpose: testPurpose }),
    });
    setTestingSms(false);
    setStatus((prev) => ({
      ...prev,
      sms: result.ok
        ? {
            kind: "ok",
            text:
              typeof result.data.message === "string"
                ? result.data.message
                : "已发送",
          }
        : { kind: "error", text: result.error || "试发失败" },
    }));
  }

  return (
    <div className="space-y-6">
      <form
        className="surface space-y-3 rounded-[28px] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveSection("site", pick(form, SITE_KEYS), "站点设置已保存");
        }}
      >
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
        <SectionSaveBar
          saving={saving === "site"}
          status={status.site}
          label="保存站点设置"
        />
      </form>

      <form
        className="surface space-y-3 rounded-[28px] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveSection("sms", pick(form, SMS_KEYS), "手机号验证码设置已保存");
        }}
      >
        <h2 className="text-lg font-semibold">手机号验证码</h2>
        <p className="text-sm text-[var(--muted)]">
          用户填写手机号后收取 6 位验证码，即可注册、登录，或在个人中心绑定到已有账号。关闭测试模式并填好 AccessKey 后，验证码会发到手机。
        </p>
        <p className="rounded-2xl bg-[var(--bg-deep)]/50 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          阿里云国内短信已过审：签名「歪歪滴艾斯杭州科技」。登录 / 注册默认用
          SMS_512395568（注册登录），绑定手机号默认用 SMS_338610504（验证码短信）。三个场景可以各填各的
          CODE，改完点「保存手机号验证码」。要发到用户手机，必须关掉测试模式。
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
            Secret 填在下面，点「保存手机号验证码」。
          </p>
        ) : null}
        <label className="block text-sm">
          阿里云 AccessKeyId
          <input
            className="field mt-1"
            value={form.smsAccessKeyId}
            onChange={(e) => set("smsAccessKeyId", e.target.value)}
            placeholder="LTAI..."
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          阿里云 AccessKeySecret
          <input
            className="field mt-1"
            type="password"
            value={form.smsAccessKeySecret}
            onChange={(e) => set("smsAccessKeySecret", e.target.value)}
            placeholder="保存后只显示打码"
            autoComplete="new-password"
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
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">各场景模板 CODE</legend>
          <p className="text-xs leading-5 text-[var(--muted)]">
            登录、注册、绑定会按这里分别发。CODE 必须和阿里云控制台过审模板一致，模板里要有变量
            code。
          </p>
          <label className="block text-sm">
            登录
            <input
              className="field mt-1"
              value={form.smsTemplateCodeLogin}
              onChange={(e) => set("smsTemplateCodeLogin", e.target.value)}
              placeholder="SMS_512395568"
            />
          </label>
          <label className="block text-sm">
            注册
            <input
              className="field mt-1"
              value={form.smsTemplateCodeRegister}
              onChange={(e) => set("smsTemplateCodeRegister", e.target.value)}
              placeholder="SMS_512395568"
            />
          </label>
          <label className="block text-sm">
            账号绑定手机号
            <input
              className="field mt-1"
              value={form.smsTemplateCodeBind}
              onChange={(e) => set("smsTemplateCodeBind", e.target.value)}
              placeholder="SMS_338610504"
            />
          </label>
        </fieldset>
        <SectionSaveBar
          saving={saving === "sms"}
          status={status.sms}
          label="保存手机号验证码"
        />
        <div className="rounded-2xl bg-[var(--bg-deep)]/50 p-3">
          <p className="text-sm font-medium">试发到手机</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            先点上面的「保存手机号验证码」，选好场景，再用自己的手机号测一次。测试模式不会真发短信。
          </p>
          <label className="mt-2 block text-sm">
            试发场景
            <select
              className="field mt-1"
              value={testPurpose}
              onChange={(e) =>
                setTestPurpose(e.target.value as "login" | "register" | "bind")
              }
            >
              <option value="login">登录</option>
              <option value="register">注册</option>
              <option value="bind">绑定手机号</option>
            </select>
          </label>
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
      </form>

      <form
        className="surface space-y-3 rounded-[28px] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveSection("wechat", pick(form, WECHAT_KEYS), "微信授权设置已保存");
        }}
      >
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
        <SectionSaveBar
          saving={saving === "wechat"}
          status={status.wechat}
          label="保存微信授权"
        />
      </form>
    </div>
  );
}
