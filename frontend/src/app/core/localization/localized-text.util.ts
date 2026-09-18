/** Translate complete words/phrases, never fragments inside a different word. */
export function replaceTranslationFragment(value: string, source: string, target: string): string {
  if (!source) return value;
  const wordCharacter = /[\p{L}\p{N}]/u;
  return value.replaceAll(source, (match, offset: number, original: string) => {
    const joinsLeft = wordCharacter.test(match[0]) && wordCharacter.test(original[offset - 1] ?? '');
    const joinsRight = wordCharacter.test(match[match.length - 1]) && wordCharacter.test(original[offset + match.length] ?? '');
    return joinsLeft || joinsRight ? match : target;
  });
}
