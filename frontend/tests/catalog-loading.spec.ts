import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Subject,
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  tap
} from 'rxjs';
import { compileMembers } from './support/source-harness.ts';
import { pageFromMeta, totalFromMeta } from '../src/app/shared/utils/pagination.util.ts';

function state<T>(initial: T) {
  let value = initial;
  return Object.assign(() => value, {
    set: (next: T) => {
      value = next;
    }
  });
}
function fixture() {
  const Harness = compileMembers(
    new URL('../src/app/features/public/pages/catalog/catalog.component.ts', import.meta.url),
    ['ngOnInit', 'load', 'validPage'],
    {
      catchError,
      combineLatest,
      debounceTime,
      distinctUntilChanged,
      of,
      switchMap,
      tap,
      pageFromMeta,
      totalFromMeta,
      takeUntilDestroyed: () => (source: unknown) => source
    }
  );
  const view = new Harness();
  const requests: Subject<unknown>[] = [];
  const emptyParams = { get: () => null };
  Object.assign(view, {
    loadRequests: new Subject<void>(),
    searchChanges: new Subject<string>(),
    marketplace: {
      categories: () => of([]),
      servicesPage: () => {
        const request = new Subject<unknown>();
        requests.push(request);
        return request;
      }
    },
    route: {
      paramMap: new BehaviorSubject(emptyParams),
      queryParamMap: new BehaviorSubject(emptyParams)
    },
    categorySlug: state(''),
    query: state(''),
    page: state(1),
    lastPage: state(1),
    total: state(0),
    categories: state([]),
    services: state([]),
    loading: state(true),
    error: state(''),
    pageSize: 20,
    updateSeo: () => undefined,
    resolveCategoryFromUrl: () => undefined
  });
  view.ngOnInit();
  return { view, requests };
}
describe('catalog loading', () => {
  it('ignores a slower old request after the filter changes', () => {
    const { view, requests } = fixture();
    view.query.set('new filter');
    view.load();
    requests[1].next({ data: [{ id: 'new' }], meta: { page: 1, lastPage: 1, total: 1 } });
    requests[0].next({ data: [{ id: 'old' }], meta: { page: 1, lastPage: 1, total: 1 } });
    assert.deepEqual(view.services(), [{ id: 'new' }]);
    assert.equal(view.loading(), false);
  });
  it('can retry after a failure without leaving the stream closed or stale results visible', () => {
    const { view, requests } = fixture();
    requests[0].error(new Error('offline'));
    assert.equal(view.error(), 'offline');
    assert.equal(view.loading(), false);
    view.load();
    requests[1].next({
      data: [{ id: 'recovered' }],
      meta: { page: '1', lastPage: '2', total: '21' }
    });
    assert.equal(view.error(), '');
    assert.equal(view.total(), 21);
    assert.equal(view.lastPage(), 2);
  });
  it('normalizes fractional, negative, infinite and unsafe page values', () => {
    const { view } = fixture();
    for (const value of ['-1', '1.5', 'Infinity', '9007199254740992', null])
      assert.equal(view.validPage(value), 1);
  });
});
