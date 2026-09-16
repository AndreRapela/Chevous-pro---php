import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeUniqueById, pageFromMeta, totalFromMeta } from '../src/app/shared/utils/pagination.util.ts';

describe('pagination utilities', () => {
  it('normaliza metadados inválidos sem criar páginas inexistentes', () => {
    assert.equal(pageFromMeta({ page: '3' }, 'page'), 3);
    assert.equal(pageFromMeta({ lastPage: 0 }, 'lastPage'), 1);
    assert.equal(totalFromMeta({ total: 0 }), 0);
    assert.equal(totalFromMeta({ total: -1 }), 0);
  });

  it('anexa páginas sem repetir itens que foram atualizados', () => {
    const merged = mergeUniqueById([{ id: 'recent', value: 2 }, { id: 'shared', value: 3 }], [{ id: 'shared', value: 1 }, { id: 'older', value: 0 }]);
    assert.deepEqual(merged, [{ id: 'recent', value: 2 }, { id: 'shared', value: 3 }, { id: 'older', value: 0 }]);
  });
});
