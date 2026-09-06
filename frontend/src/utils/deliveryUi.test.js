import { describe, expect, it } from 'vitest';
import { normalizeFileUrl } from './deliveryUi';

describe('delivery file URL normalization', () => {
  it('keeps valid public URLs', () => {
    expect(normalizeFileUrl('https://cdn.example.com/proof.jpg')).toBe(
      'https://cdn.example.com/proof.jpg'
    );
  });

  it('resolves stored relative upload paths', () => {
    // The base URL must follow the same env the app actually uses; hardcoding
    // 5001 breaks whenever the backend runs on another port.
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const expectedOrigin = apiBase.replace(/\/api\/?$/, '');
    expect(normalizeFileUrl('/uploads/proofs/photo 1.jpg')).toBe(
      `${expectedOrigin}/uploads/proofs/photo%201.jpg`
    );
  });

  it('extracts URLs from stored media objects', () => {
    expect(normalizeFileUrl({ secure_url: 'https://cdn.example.com/signature.png' })).toBe(
      'https://cdn.example.com/signature.png'
    );
  });

  it('rejects malformed or unsafe values', () => {
    expect(normalizeFileUrl({ unexpected: true })).toBe('');
    expect(normalizeFileUrl('[object Object]')).toBe('');
    expect(normalizeFileUrl('javascript:alert(1)')).toBe('');
  });
});
