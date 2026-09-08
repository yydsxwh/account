import type { AppLocale } from "./locales";

const TABLES: Record<AppLocale, Record<string, string>> = {
  "zh-Hans": {
    "nav.home": "首页",
    "nav.account": "个人中心",
    "nav.login": "登录",
    "nav.register": "注册",
    "nav.logout": "退出",
    "nav.admin": "用户管理",
    "auth.loginTitle": "登录",
    "auth.registerTitle": "注册",
    "auth.email": "邮箱",
    "auth.password": "密码",
    "auth.submitLogin": "登录",
    "auth.submitRegister": "注册账号",
  },
  en: {
    "nav.home": "Home",
    "nav.account": "Account",
    "nav.login": "Log in",
    "nav.register": "Sign up",
    "nav.logout": "Log out",
    "nav.admin": "Users",
    "auth.loginTitle": "Log in",
    "auth.registerTitle": "Sign up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.submitLogin": "Log in",
    "auth.submitRegister": "Create account",
  },
};

export function translateMessage(
  locale: AppLocale,
  key: string,
  vars?: Record<string, string | number>,
) {
  const table = TABLES[locale] || TABLES["zh-Hans"];
  let text = table[key] || TABLES["zh-Hans"][key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
