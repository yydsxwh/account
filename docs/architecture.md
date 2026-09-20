# 账号中心架构

`account.yydsxwh.com` 是整个产品生态的统一身份平台（Identity Platform），
不是某一个产品的登录模块。主站、日事、course、forum 以及以后的新产品，
都把"这个人是谁"这件事交给它。

---

## 1. account 负责什么

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| Identity | 注册、登录、登出、会话、密码 | 已实现 |
| OAuth 2.0 / OIDC | authorize、token、userinfo、jwks、discovery、revoke、PKCE | 已实现 |
| Profile | 昵称、头像、自设账号、kk 号、locale、时区、实名 | 已实现 |
| Security | 登录设备、登录记录、安全事件、撤销会话 | 已实现 |
| Applications | 产品登记、client_id、redirect_uri、scope、客户端类型 | 已实现 |
| 邮箱验证 / 找回密码 | — | **未实现**，见第 10 节 |
| MFA / Passkey | — | **未实现**，只预留了扩展位 |
| Billing | 用户买了什么 | **未实现** |
| Entitlements | 用户拥有哪些能力 | **未实现** |
| Authorization | 用户能做什么操作 | **未实现** |

## 2. account 不负责什么

- 不存业务数据。任务、课程、订单、帖子都留在各自产品的库里。
- 不做产品内的功能权限。account 只回答"这是谁"和"授权了哪些 scope"；
  "这个人能不能删这门课"由课程产品自己判断。
- 不替产品保管会话。产品必须有自己的应用会话，不要去读 account 的 Cookie。

---

## 3. User ID

```
usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW
```

- 字段：`User.publicId`，格式 `usr_` + 26 位 Crockford base32
- 全生态唯一、永久不变，是 OIDC 的 `sub`
- **不是** email，**不是** username，**不是** 手机号，**不是** kk 号 —— 这些都能改
- 其他产品的库里只允许存这一个值

```prisma
// 日事的库应该长这样
model Task {
  id      String @id
  userId  String   // = account 的 usr_xxx
  title   String
}
```

内部主键 `User.id`（cuid）保留不动：主站 www 的双向同步脚本按 `id` 对齐，
动它会把存量用户打散。对外一律用 `publicId`。

老用户的 `publicId` 是懒补齐的（`ensureUserPublicId`），
也可以跑 `node deploy/backfill-public-ids.mjs` 一次性补完。

---

## 4. 产品绝对不能直接连 account 数据库

禁止：直连 account 的 SQLite / 读 User 表 / 读 passwordHash / 复制用户表 / 共享连接串。

唯一正确的路径：

```
产品  ──  OAuth 2.0 Authorization Code + PKCE  ──▶  account
      ◀──  ID Token / Access Token  ──
```

产品信任 account 签发的身份，而不是去读它的库。
理由：库结构会变；直连等于把密码哈希复制到每个产品；出事时无法逐个吊销。

（历史例外：主站 www 与 account 之间有一个按 `id` 对齐的双向同步脚本和共享
`AUTH_SECRET` 的 Cookie，属于遗留方案，见第 8 节。新产品不要复制这个做法。）

---

## 5. OAuth 2.0 / OpenID Connect

### 端点

| 用途 | 地址 |
| --- | --- |
| Discovery | `https://account.yydsxwh.com/.well-known/openid-configuration` |
| JWKS | `https://account.yydsxwh.com/.well-known/jwks.json` |
| Authorization | `https://account.yydsxwh.com/api/oauth/authorize` |
| Token | `https://account.yydsxwh.com/api/oauth/token` |
| UserInfo | `https://account.yydsxwh.com/api/oauth/userinfo` |
| Revocation | `https://account.yydsxwh.com/api/oauth/revoke` |

`.well-known/*` 是 `next.config.ts` 里的 rewrite，真实实现在 `/api/oidc/*`
（App Router 不会把以点开头的目录当路由）。

### 流程

```
用户访问日事
   ↓ 未登录
日事生成 state + nonce + PKCE，跳转
   ↓
account /api/oauth/authorize
   ↓ 未登录则跳 /login?next=<原始 authorize 请求>
用户登录，原样跳回 authorize
   ↓
account 签发一次性 code，跳回日事的 redirect_uri
   ↓
日事后端 POST /api/oauth/token（带 code_verifier）
   ↓
拿到 id_token + access_token（+ refresh_token）
   ↓
日事建立自己的应用会话
```

第一方产品不出授权同意页，直接放行，并记一条 `client_authorized` 安全事件。

### 支持范围

- `response_type`：只有 `code`。隐式模式和 hybrid 一律拒绝
- `grant_type`：`authorization_code`、`refresh_token`
- PKCE：只接受 `S256`。public 客户端强制，confidential 默认也要求
- 客户端认证：`client_secret_basic`、`client_secret_post`、`none`（public）
- ID Token 签名：RS256

### Token 生命周期

| 令牌 | 形态 | 有效期 | 存储 |
| --- | --- | --- | --- |
| Authorization Code | 不透明随机串 | 60 秒，一次性 | 只存 SHA-256 摘要 |
| Access Token | 不透明随机串 | 1 小时 | 只存 SHA-256 摘要 |
| Refresh Token | 不透明随机串 | 30 天，一次性 + 轮换 | 只存 SHA-256 摘要 |
| ID Token | RS256 JWT | 10 分钟 | 不落库 |

为什么 access token 不做成 JWT：不透明串可以即时吊销，泄库也拿不到能用的令牌。
产品要离线校验身份就用 ID Token + JWKS。

**重放处理**：授权码被用第二次，视为泄露，把这枚码换出去的令牌全部作废；
已轮换掉的 refresh token 再被使用，该用户在该产品下的所有 refresh token 一起作废。

### 签名密钥

优先读环境变量 `OIDC_PRIVATE_KEY`（PKCS#8 PEM），可配 `OIDC_KEY_ID`。
没配时会生成一把 RSA-2048 并存进 `SigningKey` 表，重启后 JWKS 不变。

**多实例部署必须用环境变量**，否则每个实例各自生成密钥，互相验不过对方的 token。

---

## 6. Application / Client 模型

```prisma
model OAuthClient {
  clientId      String  @unique   // rishi / course / forum
  clientType    String            // confidential | public
  clientSecret  String            // bcrypt；public 客户端不使用
  redirectUris  String            // JSON 数组，精确匹配
  allowedScopes String            // 空格分隔
  grantTypes    String            // authorization_code refresh_token
  requirePkce   Boolean
  enabled       Boolean
}
```

- **confidential**：有自己的后端，能安全保管密钥（日事后端、course 后端）
- **public**：SPA、移动 App、桌面端。没有密钥，强制 PKCE

`client_secret` 绝不能出现在浏览器 JS、App 安装包或公开仓库里。
需要在前端登录的场景一律登记成 public 客户端。

### redirect_uri 规则

只做精确匹配。不支持通配符、不支持前缀匹配、不支持"同域放行"——
这三种写法都能被改造成开放重定向，把授权码送到攻击者手上。
明文 http 只允许 `localhost` / `127.0.0.1`，线上一律 https。

---

## 7. Scope

| scope | 含义 | 状态 |
| --- | --- | --- |
| `openid` | 走 OIDC，签发 ID Token | 已实现 |
| `profile` | 昵称、头像、自设账号、locale、时区 | 已实现 |
| `email` | 邮箱 + 是否已验证 | 已实现 |
| `phone` | 手机号 | 已实现 |
| `offline_access` | 发放 refresh token | 已实现 |
| `account.basic` | kk 号、角色 | 已实现 |
| `entitlements.read` | 读取用户权益 | 占位，未实现 |
| `billing.read` | 读取订阅信息 | 占位，未实现 |

产品只能拿到自己被登记允许的 scope。请求里多写的会被丢掉，不会自动放行。
refresh 时可以缩小 scope，不能扩大。

---

## 8. Session 与 SSO

**SSO 不等于共享一个 Cookie。** 每个产品都有自己的应用会话，
只是"登录这一步"统一在 account 完成。

account 自己的会话：

- Cookie `yyds_session`，HttpOnly + SameSite=Lax + 生产环境 Secure
- 内容是 HS256 JWT，带 `sid`（UserSession 主键）和 `sst`（会话密钥）
- 服务端有 `UserSession` 表：能列设备、能撤销
- 撤销会话时，联动作废由它签发给各产品的 access / refresh token

用户在 account 登录一次后，再访问日事：日事跳 `/api/oauth/authorize`，
account 发现已有会话，直接签码跳回，用户无感。

### 遗留：与主站 www 的共享 Cookie

主站 `www.yydsxwh.com` 和 account 共用同一个 `AUTH_SECRET` 和 Cookie 名，
并且有一个按 `User.id` 对齐的双向同步脚本。这是账号中心独立出来之前的过渡方案。

它带来的后果，写清楚以免以后踩坑：

- 拿到 `AUTH_SECRET` 的人可以签发任意用户的会话
- www 签发的 Cookie 没有 `sid`，account 的"登录设备"里管不到，也撤销不了
- `getSession()` 里的 `provisionUserFromJwt` 会按 JWT 自动补建本地用户

**新产品不要用这条路。** 走 OIDC。等主站也改成 OIDC 客户端之后，
这套共享 Cookie 和同步脚本应当下线。

---

## 9. 安全边界

已经落实的：

- 密码 bcrypt（cost 10）加盐存储，绝不明文；日志里不出现密码、令牌、密钥
- 登录接口按 IP + 账号双维度限流（5 分钟内单账号 10 次、单 IP 30 次），
  token 端点按 IP 限流
- 登录失败一律回同一句话，不透露账号是否存在
- 授权码 / access token / refresh token 只存摘要
- redirect_uri 精确匹配，`redirect_uri` 不可信时就地报错，绝不跳转
- ID Token 校验固定 `algorithms: ["RS256"]`，挡 `alg=none` 和 HS256 混淆
- 校验 ID Token 必须同时比对 `iss` 和 `aud`
- 改密码自动踢掉其他设备
- 错误响应只给标准 OAuth 错误码，不带堆栈、SQL、内部路径
- 全站响应头：`X-Content-Type-Options`、`X-Frame-Options: DENY`、`Referrer-Policy`

限流是进程内滑动窗口，**横向扩容时必须换成 Redis**，否则每个实例各算各的。

## 10. 还没做的事

按重要性排：

1. **邮箱验证 + 找回密码**。`emailVerifiedAt` 字段已经加好，
   流程（验证邮件、重置令牌、邮件服务商）还没做。目前忘记密码只能找站长。
2. **密码哈希升级到 Argon2id**。现在是 bcryptjs（纯 JS、无原生依赖，
   在这台机器上最省事）。要换成 argon2 需要原生模块，且必须做在线迁移：
   登录成功时按旧算法校验、按新算法重写。
3. **MFA / Passkey**。数据结构还没建。
4. **Billing / Entitlements / Authorization**。见下一节。
5. 主站 www 改成标准 OIDC 客户端，下线共享 Cookie 和用户同步脚本。

## 11. Billing / Entitlements / Authorization 的扩展方式

现在**一个字段都还没建**，但结构上已经留好位置：不要把会员状态写成
`User.isVip = true` 这种硬编码，将来会难以拆开。

以后应该长这样：

```
Billing        用户买了什么     Subscription / Order / Payment
      ↓
Entitlements   用户拥有什么能力  Entitlement(userId, key, value, expiresAt)
      ↓
Authorization  用户能做什么      按 entitlement + role 判定
```

```
usr_9F3K...
  rishi.pro     = true, 到期 2027-01-01
  course.pro    = true
```

日事将来通过 `GET /api/entitlements?scope=entitlements.read` 问
"usr_123 有没有 rishi.pro"，而不是自己存一张会员表。
`entitlements.read` 和 `billing.read` 两个 scope 名字已经占住了。

---

## 12. 代码结构

```
packages/shared/src/
  identity/      public-id、users、rate-limit        —— 身份与账号
  oidc/          clients、server、tokens、keys、claims、
                 scopes、pkce、redirect-uri、issuer、errors
  security/      sessions、events                    —— 安全中心
  auth.ts        会话 Cookie（读写 identity + security）
  auth-providers.ts  各登录方式的落库逻辑
  oauth.ts       兼容层，转发到 oidc/*，勿在新代码里用

src/app/
  api/oauth/     authorize、token、userinfo、revoke
  api/oidc/      openid-configuration、jwks（对外是 /.well-known/*）
  api/account/   profile、password、sessions、real-name …
  api/studio/    站长后台：users、apps、settings
  account/       个人中心、安全中心
  studio/        站长后台页面
```

模块边界的约定：`oidc/` 不反向依赖 `src/app`；`security/` 只被 `auth.ts`
和账号接口使用；`oauth.ts` 只做转发，不写新逻辑。
以后要把 OIDC 拆成独立服务，搬 `packages/shared/src/oidc` + 几张表即可。

---

## 13. 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | SQLite 文件路径 |
| `AUTH_SECRET` | 是 | 会话 JWT 的 HS256 密钥；与主站 www 必须一致（遗留） |
| `NEXT_PUBLIC_SITE_URL` | 是 | 站点公网地址 |
| `OIDC_ISSUER` | 建议 | OIDC issuer，不填则用 `NEXT_PUBLIC_SITE_URL` |
| `OIDC_PRIVATE_KEY` | 多实例必需 | ID Token 签名私钥（PKCS#8 PEM） |
| `OIDC_KEY_ID` | 否 | 与上面配套的 kid |
| `COOKIE_DOMAIN` | 否 | `.yydsxwh.com`，遗留共享 Cookie 用 |
| `SMS_*` | 否 | 阿里云短信，以后台设置为准 |
| `WECHAT_*` | 否 | 微信授权 |

全部走环境变量，任何一个都不许提交进 Git。`.env*` 已在 `.gitignore` 里，
仓库中只有 `.env.example` / `.env.production.example`，里面是示例值。

生产环境额外要求：只走 HTTPS、Secure Cookie、issuer 与实际域名一致、
redirect_uri 严格登记。本地开发可以登记 `http://localhost:*` 回调，
但不要因为方便就把生产配置也放宽。
