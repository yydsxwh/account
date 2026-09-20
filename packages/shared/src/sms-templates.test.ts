import {
  ALIYUN_SMS_CODE_TEMPLATE,
  ALIYUN_SMS_LOGIN_TEMPLATE,
  ALIYUN_SMS_SIGN_NAME,
} from "./sms-templates";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(/^SMS_\d+$/.test(ALIYUN_SMS_LOGIN_TEMPLATE), "login template");
assert(/^SMS_\d+$/.test(ALIYUN_SMS_CODE_TEMPLATE), "code template");
assert(ALIYUN_SMS_SIGN_NAME.includes("歪歪滴艾斯"), "sign brand");
console.log("sms-templates ok");
