/**
 * OAuth 2.0 / OIDC 标准错误（RFC 6749 §4.1.2.1、§5.2）。
 *
 * 对外只吐标准错误码和一句人话描述，绝不把数据库报错、堆栈、
 * 内部路径、密钥或令牌原文带出去。
 */

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "access_denied"
  | "server_error"
  | "temporarily_unavailable";

export class OAuthError extends Error {
  readonly code: OAuthErrorCode;
  readonly status: number;
  /** true 表示不能跳回 redirect_uri（回调地址本身就不可信），只能就地报错 */
  readonly fatal: boolean;

  constructor(
    code: OAuthErrorCode,
    description: string,
    options: { status?: number; fatal?: boolean } = {},
  ) {
    super(description);
    this.name = "OAuthError";
    this.code = code;
    this.status = options.status ?? defaultStatus(code);
    this.fatal = options.fatal ?? false;
  }
}

function defaultStatus(code: OAuthErrorCode): number {
  switch (code) {
    case "invalid_client":
      return 401;
    case "server_error":
      return 500;
    case "temporarily_unavailable":
      return 503;
    default:
      return 400;
  }
}

export function toOAuthErrorBody(error: unknown): {
  status: number;
  body: { error: OAuthErrorCode; error_description: string };
} {
  if (error instanceof OAuthError) {
    return {
      status: error.status,
      body: { error: error.code, error_description: error.message },
    };
  }
  // 非预期异常只留在服务端日志里
  console.error("[oidc]", error);
  return {
    status: 500,
    body: { error: "server_error", error_description: "服务暂时不可用" },
  };
}
