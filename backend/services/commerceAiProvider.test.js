import { afterEach, describe, expect, it, vi } from 'vitest';
import { reserveAiUsage, commerceGenerate, parseAiObject } from './commerceAiProvider.js';
import AiDailyBudget from '../models/aiDailyBudgetModel.js';
import AiUsage from '../models/aiUsageModel.js';
import { getRuntimeConfig } from './configService.js';
vi.mock('./configService.js', () => ({ getRuntimeConfig: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const settings = { commerce_ai_enabled: true, commerce_ai_daily_budget_xaf: 100, commerce_ai_user_daily_calls: 2, commerce_ai_text_reserve_xaf: 10 };
const setup = () => { getRuntimeConfig.mockImplementation(async k => settings[k] || 0); vi.spyOn(AiDailyBudget, 'updateOne').mockResolvedValue({}); };
describe('shared AI quotas and provider boundaries', () => {
  it('denies an exhausted user before reserving global spend or calling OpenAI', async () => {
    setup(); const claim = vi.spyOn(AiDailyBudget, 'findOneAndUpdate').mockResolvedValue(null); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); vi.stubEnv('OPENAI_API_KEY', 'test');
    await expect(commerceGenerate({ actor: 'a', feature: 'shopping', data: {}, schema: {} })).rejects.toMatchObject({ status: 429 });
    expect(claim).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
  });
  it('reserves a bounded daily amount atomically and records no prompt', async () => {
    setup(); const claim = vi.spyOn(AiDailyBudget, 'findOneAndUpdate').mockResolvedValue({ calls: 1 }); const create = vi.spyOn(AiUsage, 'create').mockResolvedValue({ _id: 'usage' });
    await reserveAiUsage({ actor: 'owner', feature: 'coach', model: 'model' });
    expect(claim.mock.calls[1][0]).toMatchObject({ reservedXaf: { $lte: 90 } });
    expect(claim.mock.calls[1][1]).toEqual({ $inc: { calls: 1, reservedXaf: 10 } });
    expect(create).toHaveBeenCalledWith({ actor: 'owner', feature: 'coach', model: 'model', reservationXaf: 10 });
  });
  it('cannot bypass the global budget with a new user', async () => {
    setup(); vi.spyOn(AiDailyBudget, 'findOneAndUpdate').mockResolvedValueOnce({}).mockResolvedValueOnce(null);
    const create = vi.spyOn(AiUsage, 'create');
    await expect(reserveAiUsage({ actor: 'new', feature: 'shopping' })).rejects.toMatchObject({ status: 429 });
    expect(create).not.toHaveBeenCalled();
  });
  it('treats refusals and truncated output as failures', () => {
    expect(() => parseAiObject({ status: 'incomplete', output: [] })).toThrow();
    expect(() => parseAiObject({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] })).toThrow();
  });
});
