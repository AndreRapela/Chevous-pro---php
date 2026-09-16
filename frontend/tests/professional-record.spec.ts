import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coursePayload, experiencePayload } from '../src/app/shared/utils/professional-record.util.ts';

describe('professional record validation', () => {
  it('normaliza experiência em andamento e impede datas invertidas', () => {
    assert.deepEqual(experiencePayload('  Eletricista ', ' Autônomo ', '2022-02-01', '', '  Instalações residenciais '), {
      ok: true, value: { role: 'Eletricista', company: 'Autônomo', startedAt: '2022-02-01', endedAt: null, current: true, description: 'Instalações residenciais' }
    });
    const invalid = experiencePayload('Eletricista', 'Autônomo', '2024-01-01', '2023-12-31', '');
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.match(invalid.error, /posterior/);
    const missing = experiencePayload('', 'Autônomo', '', '', '');
    assert.equal(missing.ok, false);
    const finished = experiencePayload('Eletricista', 'Autônomo', '2022-02-01', '2023-02-01', '');
    assert.deepEqual(finished, {
      ok: true, value: { role: 'Eletricista', company: 'Autônomo', startedAt: '2022-02-01', endedAt: '2023-02-01', current: false, description: null }
    });
  });

  it('aceita somente URLs web para certificados', () => {
    const valid = coursePayload('NR-10', 'SENAI', '2023-12-01', 'https://certificados.example/nr10');
    assert.equal(valid.ok, true);
    if (valid.ok) assert.equal(valid.value.certificateUrl, 'https://certificados.example/nr10');
    const invalid = coursePayload('NR-10', 'SENAI', '', 'file:///certificado.pdf');
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.match(invalid.error, /http/);
    const malformed = coursePayload('NR-10', 'SENAI', '', 'não-é-url');
    assert.equal(malformed.ok, false);
    assert.deepEqual(coursePayload('  NR-10 ', ' SENAI ', '', ''), {
      ok: true, value: { title: 'NR-10', institution: 'SENAI', completedAt: null, certificateUrl: null }
    });
    assert.equal(coursePayload('', '', '', '').ok, false);
  });
});
