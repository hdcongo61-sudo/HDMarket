import { describe, expect, it } from 'vitest';
import { getVideoHashtags, stripVideoHashtags } from './videoHashtags';

describe('video hashtags', () => {
  it('combines caption and stored hashtags without duplicates', () => {
    expect(
      getVideoHashtags({
        caption: 'Nouvelle collection #Mode #Brazzaville',
        hashtags: ['mode', 'Congo', '#Promo', 'Nouveauté']
      })
    ).toEqual(['Mode', 'Brazzaville', 'Congo', 'Promo', 'Nouveauté']);
  });

  it('removes hashtag tokens while preserving the readable caption', () => {
    expect(stripVideoHashtags('Découvrez ceci #mode avec livraison #Congo')).toBe(
      'Découvrez ceci avec livraison'
    );
  });
});
