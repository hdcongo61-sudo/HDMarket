import { describe, expect, it } from 'vitest';
import { capitalizeName } from './nameFormatting.js';

describe('capitalizeName', () => {
  it('capitalizes a simple lowercase name', () => {
    expect(capitalizeName('jean claude')).toBe('Jean Claude');
  });

  it('lowercases the rest of an all-caps name', () => {
    expect(capitalizeName('MARIE MBEMBA')).toBe('Marie Mbemba');
  });

  it('capitalizes each part of a hyphenated name', () => {
    expect(capitalizeName('jean-pierre')).toBe('Jean-Pierre');
  });

  it('capitalizes after an apostrophe', () => {
    expect(capitalizeName("n'goma")).toBe("N'Goma");
  });

  it('collapses repeated internal whitespace and trims', () => {
    expect(capitalizeName('  oumar   diallo  ')).toBe('Oumar Diallo');
  });

  it('handles accented letters', () => {
    expect(capitalizeName('émilie ébata')).toBe('Émilie Ébata');
  });

  it('returns an empty string for empty or nullish input', () => {
    expect(capitalizeName('')).toBe('');
    expect(capitalizeName(null)).toBe('');
    expect(capitalizeName(undefined)).toBe('');
  });
});
