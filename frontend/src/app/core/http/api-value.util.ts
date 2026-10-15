/** PDO and legacy endpoints may serialize a boolean as 0/1 or a string. */
export function apiBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}
