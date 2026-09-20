import type { ReactNode } from "react";
import { WWW_HOME_URL } from "@andyyyds/shared/first-party-url";

/** 从账号中心跳回主站 www.yydsxwh.com */
export function WwwHomeLink({
  className = "btn btn-secondary min-h-10 px-3",
  children = "网站首页",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a href={WWW_HOME_URL} className={className}>
      {children}
    </a>
  );
}
