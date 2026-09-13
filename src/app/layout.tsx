import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { ReferralCapture } from "@/components/referral-capture";
import { SiteHeader } from "@/components/site-header";
import { WwwHomeLink } from "@/components/www-home-link";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eaf2f8",
};

export const metadata: Metadata = {
  title: {
    default: "账号中心",
    template: "%s · 账号中心",
  },
  description:
    "从 Andyyyds 抽出的账号系统：邮箱、登录名、手机号、微信登录与注册",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="flex min-h-full flex-col antialiased">
        <LocaleProvider locale="zh-Hans" bilingual={false}>
          <ReferralCapture />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="glass-bar border-t py-6 text-sm text-[var(--muted)]">
            <div className="container flex flex-wrap items-center justify-between gap-3">
              <span>账号中心 · 登录注册与用户管理</span>
              <WwwHomeLink className="text-[var(--brand)] hover:underline">
                返回网站首页
              </WwwHomeLink>
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
