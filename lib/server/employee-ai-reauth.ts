import { createHmac, timingSafeEqual } from 'node:crypto';

export const PAYSLIP_REAUTH_COOKIE = 'employee-ai-payslip-unlock';
export const PAYSLIP_REAUTH_SECONDS = 10 * 60;

type Payload = { purpose: 'employee-ai-payslip'; user_id: string; exp: number };

function secret() {
  return process.env.EMPLOYEE_ASK_AI_REAUTH_SECRET || process.env.N8N_EMPLOYEE_AI_WEBHOOK_SECRET || '';
}
function b64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}
function sign(payload: string) {
  return b64url(createHmac('sha256', secret()).update(payload).digest());
}
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createPayslipReauthToken(userId: string, now = Date.now()) {
  const key = secret();
  if (key.length < 32) throw new Error('Ask AI reauthentication is not configured.');
  const payload = b64url(JSON.stringify({ purpose: 'employee-ai-payslip', user_id: userId, exp: Math.floor(now / 1000) + PAYSLIP_REAUTH_SECONDS } satisfies Payload));
  return `${payload}.${sign(payload)}`;
}

export function verifyPayslipReauthToken(token: string | undefined, userId: string, now = Date.now()) {
  const key = secret();
  if (!token || key.length < 32) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  if (!safeEqual(sign(payload), signature)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<Payload>;
    return decoded.purpose === 'employee-ai-payslip' && decoded.user_id === userId && typeof decoded.exp === 'number' && decoded.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}
