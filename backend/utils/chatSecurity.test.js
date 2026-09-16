import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAccessSupportMessage, supportHistoryFilter, escapeChatSearch, isTrustedMediaUrl, validChatReaction } from './chatSecurity.js';
import { validateChatUpload } from './chatUpload.js';
import { schemas } from '../middlewares/validate.js';
const alice = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const bob = 'bbbbbbbbbbbbbbbbbbbbbbbb';
afterEach(() => vi.unstubAllEnvs());
describe('chat privacy boundaries', () => {
  it('does not allow a customer to choose another customer history', () => {
    const query = supportHistoryFilter({ id: alice, role: 'user' }, bob);
    expect(query.user.$in.map(String)).toEqual([alice, alice]);
  });
  it('allows authorized staff to select a customer', () => {
    expect(supportHistoryFilter({ id: alice, role: 'founder' }, bob).user.$in.map(String)).toEqual([bob, bob]);
  });
  it('denies reactions to other customers and unowned legacy messages', () => {
    expect(canAccessSupportMessage({ id: alice }, { user: bob })).toBe(false);
    expect(canAccessSupportMessage({ id: alice }, {})).toBe(false);
    expect(canAccessSupportMessage({ id: alice }, { user: alice })).toBe(true);
  });
  it('treats search patterns literally', () => {
    expect(escapeChatSearch('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
    expect(escapeChatSearch({ $ne: null })).toBe('');
  });
  it('rejects another Cloudinary tenant, credentials, localhost and active URLs', () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'ours');
    expect(isTrustedMediaUrl('https://res.cloudinary.com/ours/image/upload/v1/order-messages/attachments/photo.png')).toBe(true);
    for (const url of ['https://res.cloudinary.com/theirs/image/upload/chat/attachments/a.png', 'http://localhost/chat/attachments/a.png', 'javascript:alert(1)', 'https://evil@res.cloudinary.com/ours/image/upload/chat/attachments/a.png']) expect(isTrustedMediaUrl(url)).toBe(false);
  });
  it('bounds messages and reactions', () => {
    expect(validChatReaction('👍')).toBe(true);
    expect(validChatReaction({ $ne: null })).toBe(false);
    expect(schemas.orderMessage.validate({ text: {}, attachments: 'bad' }).error).toBeDefined();
    expect(schemas.orderMessage.validate({ encryptedText: 'x'.repeat(16001) }).error).toBeDefined();
    expect(schemas.orderMessage.validate({ text: 'Bonjour' }).error).toBeUndefined();
  });
});
describe('chat upload validation', () => {
  const run = (buffer, mimetype) => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    validateChatUpload({ file: { buffer, mimetype, originalname: 'file' } }, res, next);
    return { res, next };
  };
  it('rejects HTML disguised as an image', () => {
    const { res, next } = run(Buffer.from('<script>alert(1)</script>'), 'image/png');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
  it('enforces the image limit after bytes are available', () => {
    const { res } = run(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png');
    expect(res.status).toHaveBeenCalledWith(413);
  });
  it('accepts an ordinary text attachment', () => {
    expect(run(Buffer.from('Bonjour, voici la commande.'), 'text/plain').next).toHaveBeenCalledOnce();
  });
  it('rejects executable HTML in a text attachment', () => {
    expect(run(Buffer.from('<html><script>bad()</script></html>'), 'text/plain').res.status).toHaveBeenCalledWith(400);
  });
});
