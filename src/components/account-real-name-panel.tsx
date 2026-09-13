"use client";

/**
 * 个人中心补充实名。保存后站长在用户管理里能看到姓名和证件号。
 */

import { useState } from "react";
import { ID_TYPE_LABEL, ID_TYPES, type IdType } from "@andyyyds/shared/real-name";

type Props = {
  initialRealName?: string;
  initialIdType?: string;
  initialIdNumber?: string;
};

export function AccountRealNamePanel({
  initialRealName = "",
  initialIdType = "id_card",
  initialIdNumber = "",
}: Props) {
  const [realName, setRealName] = useState(initialRealName);
  const [idType, setIdType] = useState<IdType>(
    (ID_TYPES as readonly string[]).includes(initialIdType)
      ? (initialIdType as IdType)
      : "id_card",
  );
  const [idNumber, setIdNumber] = useState(initialIdNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const res = await fetch("/api/account/real-name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realName, idType, idNumber }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "保存失败");
      return;
    }
    setNotice(typeof data.message === "string" ? data.message : "实名信息已保存");
  }

  return (
    <section className="surface rounded-[28px] p-5 sm:p-6">
      <h2 className="text-lg font-semibold">实名信息</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        选填。填写后站长能在后台看到你的真实姓名和证件号，便于对账或审核。
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">真实姓名</span>
          <input
            className="field w-full"
            value={realName}
            maxLength={40}
            autoComplete="name"
            onChange={(e) => setRealName(e.target.value)}
            placeholder="与证件一致的姓名"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">证件类型</span>
          <select
            className="field w-full"
            value={idType}
            onChange={(e) => setIdType(e.target.value as IdType)}
          >
            {ID_TYPES.map((type) => (
              <option key={type} value={type}>
                {ID_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-[var(--muted)]">证件号码</span>
          <input
            className="field w-full"
            value={idNumber}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder={idType === "id_card" ? "15 或 18 位身份证号" : "证件号码"}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {notice ? (
          <p className="text-sm text-[var(--brand-strong)]">{notice}</p>
        ) : null}
        <button
          type="submit"
          className="btn btn-primary min-h-11 w-full sm:w-auto sm:px-6"
          disabled={loading}
        >
          {loading ? "保存中…" : "保存实名信息"}
        </button>
      </form>
    </section>
  );
}
