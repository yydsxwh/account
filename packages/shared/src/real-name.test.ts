import { validateRealNameInput } from "./real-name";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const ok = validateRealNameInput({
  realName: "张三",
  idType: "id_card",
  idNumber: "110101199001011234",
});
assert(ok.ok && ok.realName === "张三", "cn name");
assert(ok.ok && ok.idNumber === "110101199001011234", "id");

const short = validateRealNameInput({
  realName: "张",
  idType: "id_card",
  idNumber: "110101199001011234",
});
assert(!short.ok, "name too short");

const badId = validateRealNameInput({
  realName: "张三",
  idType: "id_card",
  idNumber: "123",
});
assert(!badId.ok, "bad id");

const passport = validateRealNameInput({
  realName: "Li Lei",
  idType: "passport",
  idNumber: "E12345678",
});
assert(passport.ok, "passport");

console.log("real-name ok");
