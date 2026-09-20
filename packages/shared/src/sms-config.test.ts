import { resolveSmsRuntime, templateCodeFor } from "./sms-config";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const empty = {
  smsEnabled: true,
  smsTestMode: true,
  smsAccessKeyId: "",
  smsAccessKeySecret: "",
  smsSignName: "",
  smsTemplateCode: "",
  smsTestFixedCode: "123456",
};

const testMode = resolveSmsRuntime(empty);
assert(testMode.testMode === true, "db test mode");
assert(testMode.signName === "歪歪滴艾斯杭州科技", "default sign");
assert(testMode.templateCode === "SMS_512395568", "default login template");
assert(testMode.templateCodeLogin === "SMS_512395568", "login approved");
assert(testMode.templateCodeRegister === "SMS_512395568", "register approved");
assert(testMode.templateCodeBind === "SMS_338610504", "bind approved");
assert(testMode.aliyunReady === false, "no key yet");

assert(
  templateCodeFor(empty, "login") === "SMS_512395568",
  "login fallback",
);
assert(
  templateCodeFor(empty, "register") === "SMS_512395568",
  "register fallback",
);
assert(templateCodeFor(empty, "bind") === "SMS_338610504", "bind fallback");

const custom = {
  ...empty,
  smsTemplateCodeLogin: "SMS_LOGIN_1",
  smsTemplateCodeRegister: "SMS_REG_1",
  smsTemplateCodeBind: "SMS_BIND_1",
};
assert(templateCodeFor(custom, "login") === "SMS_LOGIN_1", "login custom");
assert(templateCodeFor(custom, "register") === "SMS_REG_1", "register custom");
assert(templateCodeFor(custom, "bind") === "SMS_BIND_1", "bind custom");

const legacyOnly = {
  ...empty,
  smsTemplateCode: "SMS_LEGACY",
};
assert(templateCodeFor(legacyOnly, "login") === "SMS_LEGACY", "legacy login");
assert(templateCodeFor(legacyOnly, "bind") === "SMS_LEGACY", "legacy bind");

const live = resolveSmsRuntime({
  ...empty,
  smsTestMode: false,
  smsAccessKeyId: "LTAIexample",
  smsAccessKeySecret: "secret",
});
assert(live.testMode === false, "db can turn off test mode");
assert(live.aliyunReady === true, "ready with fallback sign/template");

const prev = process.env.SMS_TEST_MODE;
process.env.SMS_TEST_MODE = "1";
const envNoLongerLocks = resolveSmsRuntime({
  ...empty,
  smsTestMode: false,
  smsAccessKeyId: "LTAIexample",
  smsAccessKeySecret: "secret",
});
assert(envNoLongerLocks.testMode === false, "SMS_TEST_MODE env does not lock");
if (prev === undefined) delete process.env.SMS_TEST_MODE;
else process.env.SMS_TEST_MODE = prev;

process.env.SMS_FORCE_TEST_MODE = "1";
const forced = resolveSmsRuntime({
  ...empty,
  smsTestMode: false,
  smsAccessKeyId: "LTAIexample",
  smsAccessKeySecret: "secret",
});
assert(forced.testMode === true, "force test");
delete process.env.SMS_FORCE_TEST_MODE;

console.log("sms-config ok");
