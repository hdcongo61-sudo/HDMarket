import { describe, expect, it } from 'vitest';
import { normalizeFileUrl } from './deliveryUi';

describe('delivery file URL normalization', () => {
  it('keeps valid public URLs', () => {
    expect(normalizeFileUrl('https://cdn.example.com/proof.jpg')).toBe(
      'https://cdn.example.com/proof.jpg'
    );
  });

  it('resolves stored relative upload paths', () => {
    expect(normalizeFileUrl('/uploads/proofs/photo 1.jpg')).toBe(
      'http://localhost:5001/uploads/proofs/photo%201.jpg'
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
