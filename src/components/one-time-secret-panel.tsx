"use client";

import { useState } from "react";
import {
  ONE_TIME_SECRET_WARNING,
  buildSecretEnvFile,
  copySecretText,
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
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [actionError, setActionError] = useState("");

  async function copySecret() {
    setActionError("");
    try {
      await navigator.clipboard.writeText(
        copySecretText(revealed.clientId, revealed.clientSecret),
      );
      setCopied(true);
    } catch {
      setActionError("复制失败，请手动选中密钥");
      setCopied(false);
    }
  }

  function downloadSecret() {
    setActionError("");
    if (
      !window.confirm(
        "即将下载含 client_secret 的敏感文件，请只保存在服务器上，不要发到聊天或提交到 Git。",
      )
    ) {
      return;
    }
    const filename = secretEnvFilename(revealed.clientId);
    const contents = buildSecretEnvFile({
      clientId: revealed.clientId,
      clientSecret: revealed.clientSecret,
    });
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    setDownloaded(true);
  }

  return (
    <div
      role="dialog"
      aria-label="一次性密钥"
      className="space-y-3 rounded-[28px] border border-[var(--brand)] bg-[var(--brand-soft)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">一次性密钥</p>
          <p className="mt-1 text-sm text-[var(--fire)]">{ONE_TIME_SECRET_WARNING}</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-10 px-3" onClick={onDismiss}>
          关闭
        </button>
      </div>
      <label className="block text-sm">
        Client ID
        <input className="field mt-1 font-mono" value={revealed.clientId} readOnly />
      </label>
      <label className="block text-sm">
        Client Secret
        <input
          className="field mt-1 font-mono"
          value={revealed.clientSecret}
          readOnly
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-11 px-4" onClick={() => void copySecret()}>
          {copied ? "已复制密钥" : "复制密钥"}
        </button>
        <button type="button" className="btn btn-secondary min-h-11 px-4" onClick={downloadSecret}>
          {downloaded ? `已下载 ${secretEnvFilename(revealed.clientId)}` : "下载密钥文件"}
        </button>
      </div>
      {actionError ? <p className="text-sm text-[var(--fire)]">{actionError}</p> : null}
    </div>
  );
}
