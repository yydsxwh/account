# 账号中心

从 [Andyyyds](https://github.com/yydsxwh/Andyyyds) 复制出的账号、密码、登录、注册与用户管理。

## 功能

- 邮箱 + 密码登录 / 注册
- 登录账号 + 密码登录 / 注册（与邮箱通道分开）
- 手机号收验证码登录 / 注册（测试码 `123456`；关闭测试模式并配阿里云后发到手机）
- 微信：公众号网页授权、开放平台扫码、Android SDK
- 个人中心：昵称、头像、绑定邮箱 / 账号 / 手机 / 微信、改密码、角色申请
- 站长后台：用户列表、角色审核、邀请关系、短信与微信配置
- 多产品单点登录：一套账号进入文档、商城等已登记软件

## 本地运行

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

打开 http://localhost:3000

## 演示账号

所有密码均为 `123456`。

| 角色 | 登录 |
|------|------|
| 站长 | `admin@yyds.local` |
| 老师 | `teacher@yyds.local` |
| 加盟代理 | `agent@yyds.local` |
| 学员 | `student@yyds.local` |
| 待审商家 | `merchant@yyds.local` |
| 账号登录 | 用户名 `demo_user` |

手机号登录：登录页选「手机号」，点「获取验证码」。本地默认测试模式，验证码固定 `123456`（也写在服务器日志）。要发到用户手机：站长打开「登录设置」，选「发送到用户手机」，填阿里云 AccessKey、短信签名、模板 CODE（模板变量为 `code`），保存后可用「试发验证码」测自己的号码。也可在 `.env` 写 `SMS_ACCESS_KEY_ID` 等，并设 `SMS_TEST_MODE=0`。

## 多产品共用一套账号

账号中心相当于 Google 的 `accounts.google.com`。每个软件产品不要自己做注册，只要把用户送到这里登录。

1. 站长打开「软件产品」，登记产品名称、首页、回调地址，保存下发的 `client_id` / `client_secret`。
2. 产品里未登录时跳到：

```
https://账号中心/api/oauth/authorize?client_id=文档ID&redirect_uri=https://你的产品/auth/callback&state=随机串
```

3. 用户在账号中心登录（或已经登录则直接回来）。
4. 产品服务端用回调里的 `code` 换用户：

```http
POST /api/oauth/token
{
  "client_id": "docs",
  "client_secret": "只放在产品服务器",
  "code": "回调参数",
  "redirect_uri": "必须和登记的完全一致"
}
```

返回的 `user.id` 就是全站统一账号。产品库只存这个 id 和本站业务数据，不要再存一份密码。

本地演示：打开 `/demo/docs` 和 `/demo/shop`，用 `admin@yyds.local` / `123456` 登录。退出某个产品后，只要账号中心还在登录，再点「用账号中心登录」不用再输密码。

同父域名（如 `account.yydsxwh.com` 与 `docs.yydsxwh.com`）还可在 `.env` 设 `COOKIE_DOMAIN=.yydsxwh.com`。
