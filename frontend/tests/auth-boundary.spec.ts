import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catchError, firstValueFrom, of, switchMap, throwError } from 'rxjs';
import { isApiUrl } from '../src/app/core/http/api-url.util.ts';
import { compileInitializer, compileMembers } from './support/source-harness.ts';

class Failure extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}
class FakeRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = headers;
  }
  clone(options: { setHeaders: Record<string, string> }): FakeRequest {
    return new FakeRequest(this.url, { ...this.headers, ...options.setHeaders });
  }
}
function fixture(responses: (Failure | string)[], refreshResult: Failure | string = 'renewed') {
  const tokens = Object.fromEntries(
    ['SessionStoreService', 'Router', 'SessionRefreshService', 'DOCUMENT', 'API_BASE_URL'].map(
      (name) => [name, Symbol(name)]
    )
  );
  const requests: FakeRequest[] = [];
  let cleared = 0,
    refreshed = 0;
  const navigations: unknown[] = [];
  const services = new Map([
    [tokens.SessionStoreService, { accessToken: 'original', clear: () => cleared++ }],
    [
      tokens.Router,
      {
        url: '/conta',
        navigate: (...args: unknown[]) => {
          navigations.push(args);
          return Promise.resolve(true);
        }
      }
    ],
    [
      tokens.SessionRefreshService,
      {
        refresh: () => {
          refreshed++;
          return refreshResult instanceof Failure
            ? throwError(() => refreshResult)
            : of(refreshResult);
        }
      }
    ],
    [tokens.DOCUMENT, { location: { href: 'https://chezvouspro.com/conta' } }],
    [tokens.API_BASE_URL, '/api/v1']
  ] as [symbol, unknown][]);
  const interceptor = compileInitializer(
    new URL('../src/app/core/auth/auth-token.interceptor.ts', import.meta.url),
    'authTokenInterceptor',
    {
      ...tokens,
      inject: (token: symbol) => services.get(token),
      HttpErrorResponse: Failure,
      ApiClientError: Failure,
      isApiUrl,
      catchError,
      firstValueFrom,
      of,
      switchMap,
      throwError
    }
  );
  return {
    requests,
    navigations,
    cleared: () => cleared,
    refreshed: () => refreshed,
    request: (url = '/api/v1/me') =>
      firstValueFrom(
        interceptor(new FakeRequest(url), (request: FakeRequest) => {
          requests.push(request);
          const response = responses.shift() ?? 'ok';
          return response instanceof Failure ? throwError(() => response) : of(response);
        })
      )
  };
}
describe('authentication interceptor behavior', () => {
  it('never attaches a token or renews a session for an external 401', async () => {
    const view = fixture([new Failure(401)]);
    await assert.rejects(view.request('https://evil.test/api/v1/me'));
    assert.equal(view.requests[0].headers.Authorization, undefined);
    assert.equal(view.refreshed(), 0);
    assert.equal(view.cleared(), 0);
  });
  it('attaches authentication only to the configured API', async () => {
    const view = fixture(['ok']);
    assert.equal(await view.request(), 'ok');
    assert.equal(view.requests[0].headers.Authorization, 'Bearer original');
  });
  it('renews once and retries with the renewed token', async () => {
    const view = fixture([new Failure(401), 'ok']);
    assert.equal(await view.request(), 'ok');
    assert.equal(view.requests[1].headers.Authorization, 'Bearer renewed');
    assert.equal(view.refreshed(), 1);
    assert.equal(view.cleared(), 0);
  });
  it('does not log out a valid user when the retried request fails with 500', async () => {
    const view = fixture([new Failure(401), new Failure(500)]);
    await assert.rejects(view.request(), (error: Failure) => error.status === 500);
    assert.equal(view.cleared(), 0);
    assert.equal(view.navigations.length, 0);
  });
  it('preserves the session during a temporary refresh outage', async () => {
    const view = fixture([new Failure(401)], new Failure(503));
    await assert.rejects(view.request());
    assert.equal(view.cleared(), 0);
  });
  it('clears explicitly rejected refresh sessions and retains the return URL', async () => {
    const view = fixture([new Failure(401)], new Failure(401));
    await assert.rejects(view.request());
    assert.equal(view.cleared(), 1);
    assert.deepEqual(view.navigations, [[['/entrar'], { queryParams: { returnUrl: '/conta' } }]]);
  });
  it('does not keep retrying a renewed token that was also rejected', async () => {
    const view = fixture([new Failure(401), new Failure(401)]);
    await assert.rejects(view.request());
    assert.equal(view.refreshed(), 1);
    assert.equal(view.cleared(), 1);
  });
  it('does not refresh a failed login', async () => {
    const view = fixture([new Failure(401)]);
    await assert.rejects(view.request('/api/v1/auth/login'));
    assert.equal(view.refreshed(), 0);
  });
});

it('session state works when browser storage access throws or is unavailable', () => {
  const Harness = compileMembers(
    new URL('../src/app/core/auth/session-store.service.ts', import.meta.url),
    [
      'accessToken',
      'hasSessionHint',
      'save',
      'clear',
      'isAllowedRole',
      'isUser',
      'sessionStorage',
      'localStorage',
      'removeLegacyStorage',
      'readStorage',
      'writeStorage',
      'removeStorage'
    ],
    {
      isPlatformBrowser: () => true,
      ROLES: ['customer', 'provider', 'admin'],
      SESSION_HINT_KEY: 'hint',
      LEGACY_ACCESS_TOKEN_KEY: 'legacy-access',
      LEGACY_REFRESH_TOKEN_KEY: 'legacy-refresh',
      LEGACY_USER_KEY: 'legacy-user'
    }
  );
  const session = new Harness();
  let current: unknown = null;
  session.currentUser = Object.assign(() => current, {
    set: (value: unknown) => {
      current = value;
    }
  });
  const user = {
    id: 'customer-1',
    name: 'Customer',
    email: 'customer@example.test',
    role: 'customer'
  };
  session.save(user, 'memory-only-token');
  assert.equal(session.accessToken, 'memory-only-token');
  assert.equal(session.hasSessionHint, false);
  assert.equal(current, user);
  session.clear();
  assert.equal(session.accessToken, null);
});
