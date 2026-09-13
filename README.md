# 账号中心

从 [Andyyyds](https://github.com/yydsxwh/Andyyyds) 复制出的账号、密码、登录、注册与用户管理。

## 功能

- 邮箱 + 密码登录 / 注册
- 登录账号 + 密码登录 / 注册（与邮箱通道分开）
- 手机号 + 短信验证码登录 / 注册（默认测试码 `123456`）
- 微信：公众号网页授权、开放平台扫码、Android SDK
- 个人中心：昵称、头像、绑定邮箱 / 账号 / 手机 / 微信、改密码、角色申请
- 站长后台：用户列表、角色审核、邀请关系、短信与微信配置

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

手机号登录：系统设置里已开启短信测试模式，验证码固定为 `123456`。
