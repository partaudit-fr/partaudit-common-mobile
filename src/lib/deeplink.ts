// Universal Link resolver — turns any partaudit URL (https://partaudit.fr/...,
// https://pro.partaudit.fr/..., custom scheme partaudit://, push-notification
// `data.link` payload) into an expo-router target.
//
// Each consuming app passes its own `RouteMap` because mobile-client and
// mobile-pro have different expo-router screen trees (e.g. a reservation
// detail is `/account/reservation-detail` on the client and `/missions/[id]`
// on the pro). Path matching itself is identical — only the destinations
// differ.
//
// The backend hands us a single canonical URL via the notification
// `link` payload; we route it. This replaces the previous mobile_route
// `screen:param` format which required parallel maintenance on every
// service that emits a notification.

export interface DeepLinkRoute {
  pathname: string;
  params?: Record<string, string>;
}

/**
 * A single match in a RouteMap. The `path` is a regex applied to the
 * pathname *after* locale prefix stripping. Capture groups become
 * `params` entries keyed by `paramNames`.
 */
export interface RouteMatch {
  path: RegExp;
  pathname: string;
  paramNames?: string[];
}

export interface RouteMap {
  /** Ordered list — first match wins. */
  matches: RouteMatch[];
  /** Returned when the URL is a known partaudit URL but no match. */
  fallback?: DeepLinkRoute;
}

function stripLocale(p: string): string {
  return p.replace(/^\/(fr|en)\//, '/');
}

// Strict allowlist — matches the apex domain or any subdomain only,
// rejecting prefix-impersonation attacks like `evilpartaudit.fr` or
// `devpartaudit.fr` (the old dev domain we no longer own). Naive
// `endsWith('partaudit.fr')` would let those through.
const ALLOWED_APEX = ['partaudit.fr', 'devpartaudit.xyz'];
function isAllowedHost(hostname: string): boolean {
  return ALLOWED_APEX.some(
    (apex) => hostname === apex || hostname.endsWith('.' + apex),
  );
}

function buildParams(m: RegExpMatchArray, names?: string[]): Record<string, string> {
  if (!names) return {};
  const out: Record<string, string> = {};
  names.forEach((n, i) => {
    const v = m[i + 1];
    if (v) out[n] = v;
  });
  return out;
}

/** Parse the URL the backend hands us. Accepts:
 *   - https://partaudit.fr/...           (Universal Link, client domain)
 *   - https://pro.partaudit.fr/...       (Universal Link, pro domain)
 *   - https://devpartaudit.xyz/...       (Universal Link, dev client)
 *   - https://pro.devpartaudit.xyz/...   (Universal Link, dev pro)
 *   - partaudit://path/...               (legacy custom scheme)
 *   - partauditpro://path/...            (legacy pro scheme)
 *   - screen:param                       (legacy mobile_route format)
 *
 * `devpartaudit.fr` was the old dev domain; it's no longer owned by us
 * and is intentionally dropped from the whitelist to avoid resolving
 * crafted links from a future squatter.
 */
export function parseDeepLinkPath(url: string): string | null {
  if (!url) return null;

  if (url.startsWith('partaudit://')) return '/' + url.slice('partaudit://'.length);
  if (url.startsWith('partauditpro://')) return '/' + url.slice('partauditpro://'.length);

  // Legacy `screen:param` survives until every service has migrated to
  // the canonical URL — translate it on the fly.
  if (!url.includes('//') && url.includes(':')) {
    const [screen, param] = url.split(':');
    return param ? `/${screen}/${param}` : `/${screen}`;
  }

  try {
    const parsed = new URL(url);
    if (isAllowedHost(parsed.hostname)) {
      return stripLocale(parsed.pathname);
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveDeepLink(url: string, map: RouteMap): DeepLinkRoute | null {
  const path = parseDeepLinkPath(url);
  if (!path) return null;

  const cleaned = path.replace(/\/$/, '') || '/';
  for (const entry of map.matches) {
    const m = cleaned.match(entry.path);
    if (m) {
      return { pathname: entry.pathname, params: buildParams(m, entry.paramNames) };
    }
  }
  return map.fallback ?? null;
}
