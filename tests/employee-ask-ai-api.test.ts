import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: { id: 'alice' } as { id: string } | null, profile: { role: 'employee', is_active: true, full_name: 'Alice Test' }, allowed: true, rateError: null as unknown }));
const mock = vi.hoisted(() => ({ answer: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user }, error: null }) }, from: mock.from }) }));
vi.mock('@/lib/server/supabase-admin', () => ({ createSupabaseAdminClient: () => ({ rpc: mock.rpc }) }));
vi.mock('@/lib/server/employee-ai', async importOriginal => ({ ...await importOriginal<object>(), answerEmployeeQuestion: mock.answer }));
import { GET, POST } from '@/app/api/employee-ask-ai/route';

const request = (body: unknown) => new Request('http://localhost/api/employee-ask-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); state.user = { id: 'alice' }; state.profile = { role: 'employee', is_active: true, full_name: 'Alice Test' }; state.allowed = true; state.rateError = null;
  mock.from.mockImplementation(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.profile, error: null }) }) }) }));
  mock.rpc.mockImplementation(async () => ({ data: state.allowed, error: state.rateError }));
  mock.answer.mockResolvedValue({ answer: 'Synthetic answer' });
});
describe('authenticated Ask AI HTTP boundary', () => {
  it('rejects unauthenticated GET and POST without calling AI', async () => {
    state.user = null;
    expect((await POST(request({ question: 'my salary' }))).status).toBe(401);
    expect((await GET(new Request('http://localhost/api/employee-ask-ai'))).status).toBe(401);
    expect(mock.answer).not.toHaveBeenCalled();
  });
  it.each([{ role: 'admin', is_active: true }, { role: 'employee', is_active: false }])('refuses unauthorized profile %j', profile => {
    Object.assign(state.profile, profile);
    return POST(request({ question: 'my salary' })).then(response => { expect(response.status).toBe(403); expect(mock.answer).not.toHaveBeenCalled(); });
  });
  it('rejects body identity overrides before invoking AI or rate limiter', async () => {
    expect((await POST(request({ question: 'my salary', user_id: 'bob' }))).status).toBe(400);
    expect(mock.answer).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('enforces a bounded request body without trusting content-length', async () => {
    expect((await POST(request({ question: 'x'.repeat(5000) }))).status).toBe(413);
    expect(mock.answer).not.toHaveBeenCalled();
  });
  it('fails closed when the shared rate limiter is unavailable', async () => {
    state.rateError = { code: 'unavailable' };
    expect((await POST(request({ question: 'my salary' }))).status).toBe(503);
    expect(mock.answer).not.toHaveBeenCalled();
  });
  it('returns retry-after when rate limited', async () => {
    state.allowed = false;
    const response = await POST(request({ question: 'my salary' }));
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60'); expect(mock.answer).not.toHaveBeenCalled();
  });
  it('passes verified owner and returns a noncacheable response', async () => {
    const response = await POST(request({ question: 'my salary' }));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mock.answer.mock.calls[0][0]).toMatchObject({ userId: 'alice', fullName: 'Alice Test' });
    expect(mock.rpc.mock.calls[0][1].p_user_id).toBe('alice');
  });
});
