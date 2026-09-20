/**
 * 实名信息：用户在个人中心补充，站长在用户管理里看全文。
 */

export const ID_TYPES = ["id_card", "passport", "hk_mo_tw", "other"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const ID_TYPE_LABEL: Record<IdType, string> = {
  id_card: "身份证",
  passport: "护照",
  hk_mo_tw: "港澳台证件",
  other: "其他证件",
};

export function isIdType(value: string): value is IdType {
  return (ID_TYPES as readonly string[]).includes(value);
}

export function idTypeLabel(value: string) {
  return isIdType(value) ? ID_TYPE_LABEL[value] : ID_TYPE_LABEL.other;
}

const CN_ID = /^(\d{15}|\d{17}[\dXx])$/;
const PASSPORT = /^[A-Za-z0-9]{5,20}$/;

export function normalizeIdNumber(raw: string, idType: IdType) {
  const value = raw.trim().replace(/\s+/g, "");
  if (idType === "id_card") return value.toUpperCase();
  return value;
}

export function validateRealNameInput(input: {
  realName: string;
  idType?: string;
  idNumber: string;
}):
  | { ok: true; realName: string; idType: IdType; idNumber: string }
  | { ok: false; error: string } {
  const realName = input.realName.trim();
  if (realName.length < 2) {
    return { ok: false, error: "请填写真实姓名（至少 2 个字）" };
  }
  if (realName.length > 40) {
    return { ok: false, error: "真实姓名最多 40 个字" };
  }
  const idType = isIdType(input.idType || "id_card")
    ? (input.idType as IdType) || "id_card"
    : null;
  if (!idType) {
    return { ok: false, error: "请选择证件类型" };
  }
  const idNumber = normalizeIdNumber(input.idNumber, idType);
  if (!idNumber) {
    return { ok: false, error: "请填写证件号码" };
  }
  if (idType === "id_card" && !CN_ID.test(idNumber)) {
    return { ok: false, error: "请填写 15 或 18 位身份证号" };
  }
  if (idType === "passport" && !PASSPORT.test(idNumber)) {
    return { ok: false, error: "护照号码格式不对" };
  }
  if (idNumber.length > 40) {
    return { ok: false, error: "证件号码过长" };
  }
  return { ok: true, realName, idType, idNumber };
}
