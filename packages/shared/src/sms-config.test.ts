import { resolveSmsRuntime } from "./sms-config";

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
assert(testMode.templateCode === "SMS_512395568", "default template");
assert(testMode.aliyunReady === false, "no key yet");

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
