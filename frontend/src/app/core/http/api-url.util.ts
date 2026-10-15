/** Matches the configured API origin and path, never a look-alike third-party URL. */
export function isApiUrl(requestUrl: string, apiBaseUrl: string, documentUrl: string): boolean {
  try {
    const base = new URL(apiBaseUrl, documentUrl);
    const request = new URL(requestUrl, documentUrl);
    const basePath = base.pathname.replace(/\/+$/, '');
    return (
      ['http:', 'https:'].includes(base.protocol) &&
      request.origin === base.origin &&
      !request.username &&
      !request.password &&
      (request.pathname === basePath || request.pathname.startsWith(`${basePath}/`))
    );
  } catch {
    return false;
  }
}
