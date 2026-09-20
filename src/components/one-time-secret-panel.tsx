"use client";

import { useState } from "react";
import {
  ONE_TIME_SECRET_WARNING,
  buildSecretEnvFile,
  secretEnvFilename,
} from "@/helpers/one-time-client-secret";

export type RevealedSecret = {
  clientId: string;
  clientSecret: string;
};

export function OneTimeSecretPanel({
  revealed,
  onDismiss,
}: {
  revealed: RevealedSecret;
  onDismiss: () => void;
}) {
  const [feedback, setFeedback] = useState("");

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(`${label}已复制`);
    } catch {
      setFeedback("复制失败，请手动选中文本复制");
    }
  }

  function downloadSecret() {
    const filename = secretEnvFilename(revealed.clientId);
    const contents = buildSecretEnvFile(revealed);
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    setFeedback(`已下载 ${filename}`);
  }

  return (
    <section
      role="dialog"
      aria-label="一次性客户端密钥"
      className="space-y-4 rounded-[28px] border border-[var(--brand)] bg-[var(--brand-soft)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">产品接入凭据</h2>
          <p className="mt-1 text-sm text-[var(--fire)]">{ONE_TIME_SECRET_WARNING}</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-10 px-3" onClick={onDismiss}>
          关闭
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm">
          Client ID
          <input className="field mt-1 font-mono" value={revealed.clientId} readOnly />
        </label>
        <button
          type="button"
          className="btn btn-secondary min-h-10 px-3"
          onClick={() => void copy(revealed.clientId, "Client ID")}
        >
          复制 Client ID
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm">
          Client Secret
          <input className="field mt-1 font-mono" value={revealed.clientSecret} readOnly />
        </label>
        <button
          type="button"
          className="btn btn-primary min-h-10 px-3"
          onClick={() => void copy(revealed.clientSecret, "Client Secret")}
        >
          复制 Client Secret
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary min-h-11 px-4"
          onClick={() =>
            void copy(
              `ACCOUNT_ISSUER=https://account.yydsxwh.com\nACCOUNT_CLIENT_ID=${revealed.clientId}\nACCOUNT_CLIENT_SECRET=${revealed.clientSecret}`,
              "完整配置",
            )
          }
        >
          复制完整配置
        </button>
        <button type="button" className="btn btn-secondary min-h-11 px-4" onClick={downloadSecret}>
          下载密钥文件
        </button>
      </div>

      {feedback ? <p className="text-sm text-[var(--brand)]">{feedback}</p> : null}
    </section>
  );
}
