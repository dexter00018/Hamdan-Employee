import type { SupabaseClient } from '@supabase/supabase-js';
import { EmployeeAIError } from '@/lib/server/employee-ai';

type Language = 'auto' | 'tl' | 'en';
type ProfileQuestion = 'employee_id' | 'employee_rank' | 'direct_lead' | 'leave_approval_route' | 'profile_details';

const normalize = (value: string) => value
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function detectLanguage(question: string, requested: Language) {
  if (requested === 'tl' || requested === 'en') return requested;
  const q = normalize(question);
  return /\b(ako|ko|akin|ang|ano|sino|kanino|yung|ba|po|aking|meron|lead ko|rank ko|empleyado|empleyado ko)\b/i.test(q) ? 'tl' : 'en';
}

function detectProfileQuestion(question: string): ProfileQuestion | null {
  const q = normalize(question);

  if (
    /\b(employee|staff|company|work)\s*(id|number|no)\b/.test(q) ||
    /\b(id|number|no)\s*(ko|akin)\b/.test(q) ||
    /\bano\s+(ang\s+)?(employee\s+)?(id|number)\s+ko\b/.test(q) ||
    /\bwhat\s+is\s+my\s+(employee\s+)?(id|number)\b/.test(q)
  ) return 'employee_id';

  if (
    /\b(direct|team|reporting)\s+lead\b/.test(q) ||
    /\bwho\s+(is|s)\s+my\s+(direct\s+|team\s+)?lead\b/.test(q) ||
    /\bsino\s+(ang\s+)?(direct\s+|team\s+)?lead\s+ko\b/.test(q) ||
    /\bkanino\s+ako\s+(naka\s*)?(assign|report)\b/.test(q) ||
    /\bmy\s+lead\b/.test(q) ||
    /\blead\s+ko\b/.test(q)
  ) return 'direct_lead';

  if (
    /\b(employee\s+)?rank\b/.test(q) ||
    /\brank\s+ko\b/.test(q) ||
    /\bam\s+i\s+(an?\s+)?(associate|lead)\b/.test(q) ||
    /\bassociate\s+ba\s+ako\b/.test(q) ||
    /\blead\s+ba\s+ako\b/.test(q)
  ) return 'employee_rank';

  if (
    /\bwho\s+(approves?|will\s+approve|is\s+approving)\s+my\s+leave\b/.test(q) ||
    /\bwho\s+is\s+my\s+(leave\s+)?approver\b/.test(q) ||
    /\b(first|next)\s+(leave\s+)?approver\b/.test(q) ||
    /\bleave\s+approval\s+route\b/.test(q) ||
    /\bsino\s+(ang\s+)?(mag\s*)?approve\s+(ng\s+)?leave\s+ko\b/.test(q) ||
    /\bsino\s+muna\s+(ang\s+)?(mag\s*)?approve\b/.test(q) ||
    /\bkanino\s+(muna\s+)?mapupunta\s+(ang\s+)?leave\s+ko\b/.test(q)
  ) return 'leave_approval_route';

  if (
    /\bmy\s+(employee|profile)\s+details\b/.test(q) ||
    /\bshow\s+my\s+(employee|profile)\s+(details|information|info)\b/.test(q) ||
    /\b(employee|profile)\s+(details|information|info)\s+ko\b/.test(q)
  ) return 'profile_details';

  return null;
}

export function mightNeedEmployeeProfileAnswer(question: string) {
  return detectProfileQuestion(question) !== null;
}

export async function answerEmployeeProfileQuestion(params: {
  client: SupabaseClient;
  userId: string;
  question: string;
  language: Language;
}) {
  const metric = detectProfileQuestion(params.question);
  if (!metric) return null;

  const tl = detectLanguage(params.question, params.language) === 'tl';
  const { data: profile, error } = await params.client
    .from('profiles')
    .select('full_name,employee_id,designation,employee_email,employee_rank,direct_lead_id')
    .eq('id', params.userId)
    .maybeSingle();

  if (error || !profile) throw new EmployeeAIError('Unable to read your employee profile.');

  let lead: { full_name: string | null; designation: string | null; employee_email: string | null } | null = null;
  if (profile.direct_lead_id) {
    const { data } = await params.client
      .from('profiles')
      .select('full_name,designation,employee_email')
      .eq('id', profile.direct_lead_id)
      .eq('role', 'employee')
      .eq('is_active', true)
      .maybeSingle();
    lead = data ?? null;
  }

  const missing = tl ? 'Hindi pa naka-configure' : 'Not configured yet';
  const employeeId = profile.employee_id || missing;
  const rank = profile.employee_rank || missing;
  const leadName = lead?.full_name || missing;

  if (metric === 'employee_id') {
    return { answer: tl ? `Ang Employee ID mo ay ${employeeId}.` : `Your Employee ID is ${employeeId}.`, source: 'employee_profile' };
  }

  if (metric === 'employee_rank') {
    return { answer: tl ? `Ang leave rank mo ay ${rank}.` : `Your leave rank is ${rank}.`, source: 'employee_profile' };
  }

  if (metric === 'direct_lead') {
    if (!profile.direct_lead_id || !lead) {
      const note = profile.employee_rank === 'Lead'
        ? (tl ? 'Lead ang rank mo, kaya walang Direct Lead approval stage ang sarili mong leave at diretso ito sa HR.' : 'Your rank is Lead, so your own leave has no Direct Lead approval stage and goes directly to HR.')
        : (tl ? 'Wala pang active Direct Lead na naka-assign sa profile mo. Kontakin ang HR/Admin para sa hierarchy setup.' : 'There is no active Direct Lead assigned to your profile yet. Contact HR/Admin for hierarchy setup.');
      return { answer: note, source: 'employee_profile' };
    }
    return { answer: tl ? `Ang Direct Lead mo ay ${leadName}${lead.designation ? ` (${lead.designation})` : ''}.` : `Your Direct Lead is ${leadName}${lead.designation ? ` (${lead.designation})` : ''}.`, source: 'employee_profile' };
  }

  if (metric === 'leave_approval_route') {
    if (profile.employee_rank === 'Associate') {
      if (!profile.direct_lead_id || !lead) {
        return { answer: tl ? 'Associate ang rank mo pero wala pang active Direct Lead na naka-configure. Kontakin ang HR/Admin bago mag-file ng leave.' : 'Your rank is Associate, but no active Direct Lead is configured yet. Contact HR/Admin before filing leave.', source: 'employee_profile' };
      }
      return { answer: tl ? `Ang leave approval route mo ay ${leadName} (Direct Lead) muna, pagkatapos HR para sa final approval.` : `Your leave approval route is ${leadName} (Direct Lead) first, then HR for final approval.`, source: 'employee_profile' };
    }
    if (profile.employee_rank === 'Lead') {
      return { answer: tl ? 'Lead ang rank mo, kaya ang leave request mo ay diretso sa HR para sa approval.' : 'Your rank is Lead, so your leave request goes directly to HR for approval.', source: 'employee_profile' };
    }
    return { answer: tl ? 'Hindi pa naka-configure ang leave rank mo. Kontakin ang HR/Admin para ma-set ang Rank at Direct Lead kung kailangan.' : 'Your leave rank is not configured yet. Contact HR/Admin to set your Rank and Direct Lead if needed.', source: 'employee_profile' };
  }

  const lines = tl
    ? [
        `Pangalan: ${profile.full_name || missing}`,
        `Employee ID: ${employeeId}`,
        `Designation: ${profile.designation || missing}`,
        `Leave Rank: ${rank}`,
        `Direct Lead: ${leadName}`,
        `Work email: ${profile.employee_email || missing}`,
      ]
    : [
        `Name: ${profile.full_name || missing}`,
        `Employee ID: ${employeeId}`,
        `Designation: ${profile.designation || missing}`,
        `Leave Rank: ${rank}`,
        `Direct Lead: ${leadName}`,
        `Work email: ${profile.employee_email || missing}`,
      ];
  return { answer: lines.join('\n'), source: 'employee_profile' };
}
