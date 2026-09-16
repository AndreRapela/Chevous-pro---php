export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function avatarFileError(file: Pick<File, 'type' | 'size'> | null | undefined): string | null {
  if (!file) return 'Escolha uma imagem para continuar.';
  if (!AVATAR_MIME_TYPES.has(file.type)) return 'Use uma imagem JPG, PNG ou WebP.';
  if (file.size < 1 || file.size > MAX_AVATAR_SIZE_BYTES) return 'A foto deve ter no máximo 5 MB.';
  return null;
}

export function profileInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}
