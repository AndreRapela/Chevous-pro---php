import type { ProfessionalCourse, ProfessionalExperience } from '../../core/models';

type RecordResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function experiencePayload(roleInput: string, companyInput: string, startedAt: string, endedAt: string, descriptionInput: string): RecordResult<Omit<ProfessionalExperience, 'id'>> {
  const role = roleInput.trim();
  const company = companyInput.trim();
  const description = descriptionInput.trim();

  if (!role || !company || !startedAt) return { ok: false, error: 'Preencha função, empresa e data de início.' };
  if (endedAt && endedAt < startedAt) return { ok: false, error: 'A data de término deve ser posterior à data de início.' };

  return { ok: true, value: { role, company, startedAt, endedAt: endedAt || null, current: !endedAt, description: description || null } };
}

export function coursePayload(titleInput: string, institutionInput: string, completedAt: string, certificateUrlInput: string): RecordResult<Omit<ProfessionalCourse, 'id'>> {
  const title = titleInput.trim();
  const institution = institutionInput.trim();
  const certificateUrl = certificateUrlInput.trim();

  if (!title || !institution) return { ok: false, error: 'Preencha o curso e a instituição.' };
  if (certificateUrl) {
    try {
      const url = new URL(certificateUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    } catch {
      return { ok: false, error: 'Informe um link de certificado válido, iniciado por http:// ou https://.' };
    }
  }

  return { ok: true, value: { title, institution, completedAt: completedAt || null, certificateUrl: certificateUrl || null } };
}
