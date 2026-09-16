/**
 * Normaliza o domínio aceito pelo SSR sem confiar em cabeçalhos encaminhados.
 * `Host` é entrada não confiável mesmo atrás de um proxy reverso.
 */
function hostName(value: string): string | null {
  try {
    if (!value || value.includes(',') || /[\s@/\\]/.test(value)) return null;
    const parsed = new URL(`http://${value}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function origin(value: string | undefined): string {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : '';
  } catch {
    return '';
  }
}

export function allowedSeoHosts(value: string | undefined, siteUrl: string | undefined): ReadonlySet<string> {
  const configured = (value ?? '').split(',').map((entry) => hostName(entry.trim())).filter((entry): entry is string => Boolean(entry));
  const siteHost = origin(siteUrl) ? new URL(origin(siteUrl)).hostname.toLowerCase() : null;
  return new Set(siteHost ? [...configured, siteHost] : configured);
}

export function isAllowedSeoHost(host: string | undefined, allowedHosts: ReadonlySet<string>): boolean {
  const normalized = hostName(host?.trim() ?? '');
  return normalized !== null && allowedHosts.has(normalized);
}

export function resolveSeoOrigin(
  siteUrl: string | undefined,
  allowedHosts: ReadonlySet<string>,
  forwardedHost: string | undefined,
  forwardedProtocol: string | undefined
): string {
  // Uma origem pública configurada é a única fonte de canonicals em produção.
  const configured = origin(siteUrl);
  if (configured) return configured;

  if (!isAllowedSeoHost(forwardedHost, allowedHosts)) return '';
  const protocol = forwardedProtocol?.split(',')[0]?.trim().toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') return '';
  return `${protocol}://${forwardedHost!.trim()}`;
}
