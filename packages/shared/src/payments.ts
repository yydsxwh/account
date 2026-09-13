const DEFAULT_SITE_URL = "http://localhost:3000";

function normalizePublicSiteUrl(raw: string) {
  try {
    const u = new URL(raw);
    const port =
      u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
    return `${u.protocol}//${u.hostname.toLowerCase()}${port}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** 当前站点对外根地址：优先系统设置，其次环境变量 */
export async function getPublicSiteUrl() {
  const { getSiteSettings } = await import("./site-settings");
  const settings = await getSiteSettings();
  const fromDb = settings.siteUrl?.trim();
  if (fromDb) return normalizePublicSiteUrl(fromDb);
  return normalizePublicSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      DEFAULT_SITE_URL,
  );
}
