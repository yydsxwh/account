/**
 * 阿里云国内短信里已经过审的签名和模板。
 * 控制台「国内消息」：注册登录 SMS_512395568；验证码短信 SMS_338610504。
 * 登录 / 注册 / 绑定可在后台各自选 CODE；下面只是没填时的默认值。
 */

export const ALIYUN_SMS_SIGN_NAME = "歪歪滴艾斯杭州科技";

/** 登录、注册默认：过审「注册登录」模板（变量 code） */
export const ALIYUN_SMS_LOGIN_TEMPLATE = "SMS_512395568";

/** 绑定手机号默认：过审「验证码短信」模板（变量 code） */
export const ALIYUN_SMS_CODE_TEMPLATE = "SMS_338610504";

export const ALIYUN_SMS_REGISTER_TEMPLATE = ALIYUN_SMS_LOGIN_TEMPLATE;
export const ALIYUN_SMS_BIND_TEMPLATE = ALIYUN_SMS_CODE_TEMPLATE;
