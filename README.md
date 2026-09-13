# 账号中心

独立的用户账号服务，类似 Google 的 `accounts.google.com`。

- 用户只在这里注册、登录、改资料
- 站长在这里做用户管理、审核、短信/微信配置
- 你做的其他软件通过 OAuth 跳过来登录，共用同一套用户，不要再各自存密码

计划上线地址：`https://account.yydsxwh.com`（和 www.yydsxwh.com 分开部署）

## 功能

- 邮箱 / kk号 / 自设账号 / 手机验证码（阿里云） / 微信 登录与注册
- 注册后自动发 kk 号（从 3 位数 100 起，人多了自动加长）；也可自设英文+数字账号（类似微信号）
- 手机号：登录、注册、个人中心绑定同一套阿里云验证码（过审模板 SMS_512395568）
- 个人中心：绑定方式、改密码、角色申请
- 站长：用户管理、软件产品登记、登录设置
- 多产品单点登录：`/api/oauth/authorize` → `/api/oauth/token` → `/api/oauth/userinfo`

## 本地运行

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

打开 http://localhost:3000

演示账号密码均为 `123456`：`admin@yyds.local` 等。手机测试码 `123456`。

本地看多产品登录：`/demo/docs`、`/demo/shop`。接入说明：`/integrate`。

## 独立部署（和主站同一台 nginx）

www.yydsxwh.com 已在一台 Ubuntu + nginx 上。这台机器本机端口已经占用：

- `3000` www / 安妮艾斯（pm2 `yyds-course`）
- `3001` xiaowenhua.net
- `3002` zhouyuding0825.com

账号中心用 **3003**，只新增 nginx 站点和一个 systemd 服务，不要改现有三个站点的配置、证书和数据。

1. 域名解析里加一条：`account` → 这台服务器 IP（A 记录）。
2. 在服务器上（当前线上机没有 Docker，按现有站点同样用 Node + systemd）：

```bash
sudo mkdir -p /var/www/account
sudo chown admin:admin /var/www/account
git clone https://github.com/yydsxwh/account.git /var/www/account
cd /var/www/account
cp .env.production.example .env.production
# 改 AUTH_SECRET、BOOTSTRAP_ADMIN_EMAIL、BOOTSTRAP_ADMIN_PASSWORD
npm ci
npx prisma generate
npm run build
bash deploy/bootstrap-host.sh
sudo cp deploy/account.yydsxwh.com.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now account.yydsxwh.com
sudo cp deploy/nginx-account.yydsxwh.com.conf /etc/nginx/sites-available/account.yydsxwh.com
sudo ln -sf /etc/nginx/sites-available/account.yydsxwh.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d account.yydsxwh.com
```

若以后单独用 Docker，映射必须是 `3003:3000`，不要占用 3001。

3. 浏览器打开 https://account.yydsxwh.com ，用你设的站长邮箱登录。
4. 「软件产品」里登记其他产品的回调地址。产品按 `/integrate` 接入。

`COOKIE_DOMAIN=.yydsxwh.com` 让同父域名的产品更容易共用登录态。

## 和 www.yydsxwh.com 共用用户

主站以前自己注册的用户，用 `deploy/sync-users-both-ways.mjs` 按同一 `id` 和密码哈希同步进账号中心（反向也会把账号中心新用户写回主站）。线上每 2 分钟跑一次。

主站 `/login`、`/register` 会跳到 `https://account.yydsxwh.com`，登录成功后回到 www。两边 `AUTH_SECRET` 必须相同，Cookie 名都是 `yyds_session`。

在已经部署好的这台机器上：

```bash
bash /var/www/account/deploy/apply-live-sso.sh
# 然后分别重新编译账号中心和主站
```

首次启动若库是空的，会按 `.env.production` 里的 `BOOTSTRAP_ADMIN_*` 自动建站长。不要对已有数据跑 `npm run db:seed`（会清空用户）。

## 其他产品怎么接

见站内 `/integrate`，或：

```
GET  https://account.yydsxwh.com/api/oauth/authorize?client_id=&redirect_uri=&state=
POST https://account.yydsxwh.com/api/oauth/token
GET  https://account.yydsxwh.com/api/oauth/userinfo
```
