import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isApiUrl } from '../src/app/core/http/api-url.util.ts';

describe('API authentication boundary', () => {
  const documentUrl = 'https://chezvouspro.com/conta';
  it('accepts the configured relative API, its root, query and absolute equivalent', () => {
    for (const url of ['/api/v1', '/api/v1/me?tab=profile', 'https://chezvouspro.com/api/v1/me']) {
      assert.equal(isApiUrl(url, '/api/v1/', documentUrl), true);
    }
  });
  it('rejects external origins, protocol changes and look-alike paths', () => {
    for (const url of [
      'https://evil.test/api/v1/me',
      '//evil.test/api/v1/me',
      'http://chezvouspro.com/api/v1/me',
      '/api/v10/me',
      '/other/api/v1/me',
      'https://chezvouspro.com.evil.test/api/v1/me',
      'https://attacker@chezvouspro.com/api/v1/me',
      'https://:secret@chezvouspro.com/api/v1/me'
    ]) {
      assert.equal(isApiUrl(url, '/api/v1', documentUrl), false, url);
    }
  });
  it('supports explicitly configured SSR and separate API origins', () => {
    assert.equal(isApiUrl('http://api/api/v1/home', 'http://api/api/v1', documentUrl), true);
    assert.equal(isApiUrl('/api/v1/home', 'http://api/api/v1', documentUrl), false);
    assert.equal(
      isApiUrl('https://api.example.test/v2/me', 'https://api.example.test/v2', documentUrl),
      true
    );
  });
  it('fails closed for invalid or non-HTTP URLs', () => {
    assert.equal(isApiUrl('https://[invalid', '/api/v1', documentUrl), false);
    assert.equal(isApiUrl('/api/v1/me', '/api/v1', 'not a URL'), false);
    assert.equal(isApiUrl('file:///api/v1/me', 'file:///api/v1', documentUrl), false);
  });
});
