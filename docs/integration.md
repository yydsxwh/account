# 新产品接入统一账号中心

写给日事、course、forum 以及以后每一个新产品的开发者（包括 Cursor）。

**两条铁律**

1. 不要自己做注册和密码。用户只在 account 注册一次。
2. 不要连 account 的数据库。只通过下面的标准协议拿身份。

---

## 0. 五分钟版本

```
Issuer     https://account.yydsxwh.com
Discovery  https://account.yydsxwh.com/.well-known/openid-configuration
```

任何支持 OpenID Connect 的库，喂给它这个 issuer 就能跑起来：
Auth.js / NextAuth 的 generic OIDC provider、`openid-client`、
`oidc-client-ts`、Spring Security、Keycloak adapter 都可以。

产品库里存用户，只存 ID Token 里的 `sub`（形如 `usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW`）。

---

## 1. 先在账号中心登记产品

站长打开 https://account.yydsxwh.com/studio/apps ，新建一个产品，填：

| 项 | 说明 |
| --- | --- |
| 名称 | 显示给用户看，例如「日事」 |
| client_id | 建议直接写产品代号：`rishi` / `course` / `forum` |
| 客户端类型 | 有后端选 **confidential**；纯前端 / App 选 **public** |
| 回调地址 | 完整 https 地址，精确匹配，可以填多个 |
| allowedScopes | 一般 `openid profile email`；要长期登录再加 `offline_access` |

保存后页面顶部会显示一次 `client_secret`，**只显示这一次**。
库里只存哈希，产品列表永远看不到明文。刷新、关掉页面、或登记时提示「产品 ID 已被占用」，都不会再看到密钥。
已经登记过的产品，在卡片上点「重新生成密钥」会再显示一次新明文，旧密钥立刻失效。
public 客户端不发密钥。

回调地址的规则（登记时就会被校验）：

- 必须写完整地址，不能带 `*`
- 线上必须 https；只有 `http://localhost` / `http://127.0.0.1` 可以是明文
- 不能带 `#` 片段
- 精确匹配：`https://rishi.yydsxwh.com/api/auth/callback` 和
  `.../callback?x=1`、`.../callback2` 都算不同地址

---

## 2. 日事的配置

以日事为例，其余产品照抄改名字即可。

```
client_id      rishi
client_type    confidential          （日事 BFF 换票，浏览器和 APK 都不持有 secret）
redirect_uri   https://www.yydsxwh.com/api/days/auth/callback
               http://localhost:5173/api/days/auth/callback     （本地开发）
scope          openid profile email offline_access
```

空库 `npm run db:seed` 会写入 `rishi`。已有生产库用 `npx tsx scripts/upsert-rishi-client.ts`，不要重新 seed。

日事仓库服务端的 `.env`：

```bash
ACCOUNT_ISSUER="https://account.yydsxwh.com"
ACCOUNT_CLIENT_ID="rishi"
ACCOUNT_CLIENT_SECRET="…登记时显示的那一串，只放服务端…"
ACCOUNT_REDIRECT_URI="https://www.yydsxwh.com/api/days/auth/callback"
# 日事自己的应用会话密钥，和 account 的 AUTH_SECRET 没有关系，不要复用
RISHI_SESSION_SECRET="另外生成一串随机值"
```

`ACCOUNT_CLIENT_SECRET` 绝不能出现在浏览器能下载到的任何文件里。

---

## 3. 登录流程

### 3.1 把用户送去 account

```ts
import crypto from "node:crypto";

const base64url = (buf: Buffer) => buf.toString("base64url");

// PKCE：verifier 存进 HttpOnly Cookie 或服务端 session，别放 localStorage
const codeVerifier = base64url(crypto.randomBytes(48));
const codeChallenge = base64url(
  crypto.createHash("sha256").update(codeVerifier, "ascii").digest(),
);
const state = base64url(crypto.randomBytes(16));
const nonce = base64url(crypto.randomBytes(16));

const authorize = new URL("/api/oauth/authorize", process.env.ACCOUNT_ISSUER);
authorize.searchParams.set("response_type", "code");
authorize.searchParams.set("client_id", process.env.ACCOUNT_CLIENT_ID!);
authorize.searchParams.set("redirect_uri", process.env.ACCOUNT_REDIRECT_URI!);
authorize.searchParams.set("scope", "openid profile email offline_access");
authorize.searchParams.set("state", state);
authorize.searchParams.set("nonce", nonce);
authorize.searchParams.set("code_challenge", codeChallenge);
authorize.searchParams.set("code_challenge_method", "S256");

// 把 state / nonce / codeVerifier 存好，回调时要用
redirect(authorize.toString());
```

`state`、`nonce`、`code_verifier` 三个都是必须的：
`state` 防 CSRF，`nonce` 防 ID Token 重放，`code_verifier` 防授权码被截走。

### 3.2 回调里换令牌

```ts
// GET /api/auth/callback?code=...&state=...
if (query.state !== savedState) throw new Error("state mismatch");

const res = await fetch(`${process.env.ACCOUNT_ISSUER}/api/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: query.code,
    redirect_uri: process.env.ACCOUNT_REDIRECT_URI!,
    code_verifier: savedCodeVerifier,
    client_id: process.env.ACCOUNT_CLIENT_ID!,
    client_secret: process.env.ACCOUNT_CLIENT_SECRET!, // public 客户端不要这行
  }),
});
const token = await res.json();
// { access_token, token_type, expires_in, scope, id_token, refresh_token? }
```

授权码 60 秒过期且只能用一次。用第二次会导致刚换到的令牌一起作废。

### 3.3 校验 ID Token

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(
  new URL("/.well-known/jwks.json", process.env.ACCOUNT_ISSUER),
);

const { payload } = await jwtVerify(token.id_token, jwks, {
  issuer: process.env.ACCOUNT_ISSUER,      // 必须校
  audience: process.env.ACCOUNT_CLIENT_ID, // 必须校
  algorithms: ["RS256"],                   // 必须固定，挡 alg 混淆
});
if (payload.nonce !== savedNonce) throw new Error("nonce mismatch");

const userId = payload.sub; // usr_xxx —— 存这个
```

`issuer` 和 `audience` 少校任何一个都是漏洞：
只验签名的话，别的产品的 token 也能拿来冒充。

### 3.4 建立产品自己的会话

```ts
await db.user.upsert({
  where: { accountUserId: payload.sub },
  create: {
    accountUserId: payload.sub,
    displayName: payload.name ?? "",
    avatarUrl: payload.picture ?? "",
  },
  update: { displayName: payload.name ?? "" },
});

// 日事自己的会话 Cookie，和 account 的 yyds_session 无关
setRishiSessionCookie({ accountUserId: payload.sub });
```

**不要**把 account 的 Cookie 当作日事的登录态，
也**不要**把 access_token 发到浏览器。

---

## 4. 拿最新资料

```bash
curl https://account.yydsxwh.com/api/oauth/userinfo \
  -H "Authorization: Bearer <access_token>"
```

```json
{
  "sub": "usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW",
  "name": "小明",
  "preferred_username": "yydsboss01",
  "picture": "https://…",
  "email": "a@b.com",
  "email_verified": false,
  "locale": "zh-Hans"
}
```

返回内容按 access token 的 scope 裁剪：没要 `email` 就没有邮箱字段。
响应里还有 `user` / `clientId` 两个旧字段，是给已上线的老产品兼容用的，
新产品不要读。

---

## 5. 续期与退出

```bash
# 续期（需要 offline_access）
curl -X POST https://account.yydsxwh.com/api/oauth/token \
  -d grant_type=refresh_token \
  -d refresh_token=<refresh_token> \
  -d client_id=rishi -d client_secret=<secret>
```

refresh token 一次性 + 轮换：每次续期都会换一张新的，旧的立刻作废。
把旧的再用一次，account 会认为泄露，作废这个用户在该产品下的全部 refresh token。
所以务必保存新返回的那张。

```bash
# 退出时主动吊销
curl -X POST https://account.yydsxwh.com/api/oauth/revoke \
  -d token=<access_or_refresh_token> \
  -d client_id=rishi -d client_secret=<secret>
```

用户在 account 的安全中心踢掉某台设备时，该设备授权给各产品的令牌会一起失效。
产品应该在 access token 失效后走续期，续期也失败就把用户送回登录。

---

## 6. 产品的数据库应该怎么建

```prisma
// 日事
model Task {
  id            String   @id @default(cuid())
  accountUserId String              // usr_xxx，唯一的用户标识
  title         String
  createdAt     DateTime @default(now())

  @@index([accountUserId])
}
```

不要建：`password`、`passwordHash`、`email` 唯一索引当账号用、
自己的注册表、`isVip` 这种硬编码会员位。

允许缓存一份昵称和头像用于展示，但要清楚那只是快照，
真值在 account，登录时刷新即可。

---

## 7. 常见错误对照

| 报错 | 原因 | 怎么修 |
| --- | --- | --- |
| `invalid_client` / 产品未登记 | client_id 写错或产品被停用 | 后台核对 client_id |
| `invalid_client` / client_secret 不正确 | 密钥错了，或 public 客户端却传了密钥 | 重新生成密钥，或改为不传 |
| 回调地址未登记 | redirect_uri 与登记值不完全一致 | 后台按完整地址登记，注意结尾斜杠和 query |
| 公开客户端必须使用 PKCE | 没带 code_challenge | 按 3.1 加上 S256 |
| `invalid_grant` / 授权码已被使用 | code 用了两次，或回调被重复请求 | 保证回调只处理一次 |
| `invalid_grant` / 授权码已过期 | 超过 60 秒 | 重新发起授权 |
| `invalid_grant` / code_verifier 校验不通过 | verifier 与 challenge 对不上 | 检查 verifier 是否被覆盖 |
| `invalid_scope` | 申请了产品没被授权的 scope | 后台调 allowedScopes |
| ID Token 验不过 | 没校 iss/aud，或 issuer 配成了带斜杠的地址 | issuer 必须与 discovery 里完全一致 |

---

## 8. 本地开发

```bash
# 账号中心
cp .env.example .env
npm install
npx prisma db push
npm run db:seed          # 只在空库上跑，会清数据
npm run dev              # http://localhost:3000
```

在 `/studio/apps` 里给本地产品登记 `http://localhost:3100/api/auth/callback`。
本地可以用明文 http，线上不行。

仓库里有两个内置的演示产品 `/demo/docs`、`/demo/shop`，
可以照着看一遍完整跳转。

---

## 9. 接入前的自检清单

- [ ] 产品已在 `/studio/apps` 登记，client_id 是产品代号
- [ ] 回调地址写的是完整 https 地址，与代码里完全一致
- [ ] 有后端 → confidential；纯前端 / App → public
- [ ] `client_secret` 只在服务端，没进前端包、没进 Git
- [ ] 授权请求带了 `state`、`nonce`、`code_challenge`（S256）
- [ ] 回调里校验了 `state`
- [ ] ID Token 校验了 `iss`、`aud`、`nonce`，并固定 `algorithms: ["RS256"]`
- [ ] 产品库里存的是 `sub`（`usr_xxx`），不是 email 或 username
- [ ] 产品有自己的会话 Cookie，没有去读 account 的 Cookie
- [ ] 产品没有自己的密码表
