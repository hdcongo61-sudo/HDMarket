import { describe, expect, it } from 'vitest';
import { generateSocialCode, normalizeSocialCode, extractSocialCodeCandidates } from './socialCodeService.js';

describe('socialCodeService', () => {
  describe('generateSocialCode', () => {
    it('always produces the HD-XXXXX shape', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(generateSocialCode()).toMatch(/^HD-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
      }
    });

    it('never uses ambiguous characters (0, O, 1, I, L)', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(generateSocialCode().replace('HD-', '')).not.toMatch(/[01ILO]/);
      }
    });

    it('is not sequential/predictable across repeated calls', () => {
      const codes = Array.from({ length: 20 }, () => generateSocialCode());
      expect(new Set(codes).size).toBe(20);
    });
  });

  describe('normalizeSocialCode', () => {
    it.each([
      ['HD-8F42K', 'HD-8F42K'],
      ['hd-8f42k', 'HD-8F42K'],
      ['HD8F42K', 'HD-8F42K'],
      ['hd 8f42k', 'HD-8F42K'],
      ['  HD-8F42K  ', 'HD-8F42K']
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeSocialCode(input)).toBe(expected);
    });

    it('returns empty string for non-code input', () => {
      expect(normalizeSocialCode('random text')).toBe('');
      expect(normalizeSocialCode('')).toBe('');
      expect(normalizeSocialCode('HD-XX')).toBe('');
    });
  });

  describe('extractSocialCodeCandidates', () => {
    it.each([
      ['HD-8F42K', ['HD-8F42K']],
      ['prix HD-8F42K', ['HD-8F42K']],
      ['Je veux HD-8F42K', ['HD-8F42K']],
      ['HD8F42K', ['HD-8F42K']],
      ['hd-8f42k', ['HD-8F42K']],
      ['Disponible HD-8F42K ?', ['HD-8F42K']]
    ])('extracts code from %s', (input, expected) => {
      expect(extractSocialCodeCandidates(input)).toEqual(expected);
    });

    it('returns an empty array when there is no code', () => {
      expect(extractSocialCodeCandidates('bonjour, prix svp ?')).toEqual([]);
    });

    it('de-duplicates repeated codes', () => {
      expect(extractSocialCodeCandidates('HD-8F42K ... HD-8F42K encore')).toEqual(['HD-8F42K']);
    });
  });
});
