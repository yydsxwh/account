/**
 * 短信运行配置：库里的系统设置 + 环境变量。
 * 关测试模式且阿里云参数齐全时，验证码发到用户手机。
 */

export type SmsSettingsInput = {
  smsEnabled: boolean;
  smsTestMode: boolean;
  smsAccessKeyId: string;
  smsAccessKeySecret: string;
  smsSignName: string;
  smsTemplateCode: string;
  smsTestFixedCode: string;
};

export type SmsRuntime = {
  enabled: boolean;
  testMode: boolean;
  aliyunReady: boolean;
  usingEnvKeys: boolean;
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  testFixedCode: string;
};

function envFlag(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return undefined;
}

function envText(name: string) {
  return process.env[name]?.trim() || "";
}

export function resolveSmsRuntime(settings: SmsSettingsInput): SmsRuntime {
  const envAccessKeyId = envText("SMS_ACCESS_KEY_ID");
  const envAccessKeySecret = envText("SMS_ACCESS_KEY_SECRET");
  const envSignName = envText("SMS_SIGN_NAME");
  const envTemplateCode = envText("SMS_TEMPLATE_CODE");

  const accessKeyId = settings.smsAccessKeyId.trim() || envAccessKeyId;
  const accessKeySecret =
    settings.smsAccessKeySecret.trim() || envAccessKeySecret;
  const signName = settings.smsSignName.trim() || envSignName;
  const templateCode = settings.smsTemplateCode.trim() || envTemplateCode;
  const aliyunReady = Boolean(
    accessKeyId && accessKeySecret && signName && templateCode,
  );
  const usingEnvKeys = Boolean(
    (!settings.smsAccessKeyId.trim() && envAccessKeyId) ||
      (!settings.smsAccessKeySecret.trim() && envAccessKeySecret) ||
      (!settings.smsSignName.trim() && envSignName) ||
      (!settings.smsTemplateCode.trim() && envTemplateCode),
  );

  const enabled = envFlag("SMS_ENABLED") ?? settings.smsEnabled;
  // 只看测试开关，不再被历史字段 smsProvider=test 锁死（否则关测试模式仍发不出短信）
  const testMode = envFlag("SMS_TEST_MODE") ?? settings.smsTestMode;

  return {
    enabled,
    testMode,
    aliyunReady,
    usingEnvKeys,
    accessKeyId,
    accessKeySecret,
    signName,
    templateCode,
    testFixedCode:
      settings.smsTestFixedCode.trim() ||
      envText("SMS_TEST_FIXED_CODE") ||
      "123456",
  };
}

export function isSmsLoginReady(settings: SmsSettingsInput) {
  const runtime = resolveSmsRuntime(settings);
  if (!runtime.enabled) return false;
  return runtime.testMode || runtime.aliyunReady;
}
