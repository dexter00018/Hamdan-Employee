'use server';

type Language = 'auto' | 'tl' | 'en';
type Entry = {
  id: string;
  terms: string[];
  en: string;
  tl: string;
};

const ENTRIES: Entry[] = [
  {
    id: 'manpower-tracker',
    terms: ['manpower tracker', 'project tracker', 'time tracker', 'project timer', 'track project', 'tracking project', 'project hours'],
    en: 'Manpower Tracker records actual project time while your attendance shift is active. It is available from 9:00 AM Manila time, pauses automatically from 12:00 PM to 1:00 PM, resumes the same project at 1:00 PM only if your shift is still open, and stops automatically when you Time Out. You can switch projects during an active tracking period; switching stops the previous project and starts the selected project.',
    tl: 'Ang Manpower Tracker ay nagre-record ng actual project time habang active ang attendance shift mo. Available ito mula 9:00 AM Manila time, automatic na nagpa-pause mula 12:00 PM hanggang 1:00 PM, at nagre-resume sa parehong project ng 1:00 PM kung open pa ang shift mo. Automatic din itong hihinto kapag nag-Time Out ka. Kapag nag-switch ka ng project habang active ang tracking, hihinto ang naunang project at magsisimula ang napili mong project.',
  },
  {
    id: 'tracker-locked',
    terms: ['tracker locked', 'tracker disabled', 'cannot start tracker', "can't start tracker", 'di ma start tracker', 'hindi ma start tracker', 'bakit disabled tracker', '9 am tracker', 'before 9', 'active shift tracker'],
    en: 'The tracker stays locked before 9:00 AM, when you have not timed in, during the 12:00 PM–1:00 PM lunch break, or after your shift has already been completed by Time Out. It can only run during an open attendance shift within the allowed tracking time.',
    tl: 'Naka-lock ang tracker bago mag-9:00 AM, kapag hindi ka pa naka-Time In, habang 12:00 PM–1:00 PM lunch break, o kapag completed na ang shift mo dahil naka-Time Out ka na. Puwede lang itong tumakbo habang open ang attendance shift at nasa allowed tracking time.',
  },
  {
    id: 'tracker-projects',
    terms: ['tracker project list', 'project list tracker', 'add tracker project', 'manpower project', 'who adds project', 'sino nag add project', 'super admin project'],
    en: 'Employees select from active Manpower projects configured by Super Admin. Employees do not create tracker projects themselves. Super Admin can add projects, optionally assign a project code, and activate or deactivate projects while historical tracked sessions remain preserved.',
    tl: 'Pumipili ang employees mula sa active Manpower projects na sine-set ng Super Admin. Hindi gumagawa ang employee ng tracker project. Puwedeng mag-add ang Super Admin ng project, optional na project code, at mag-activate o mag-deactivate habang preserved ang historical tracked sessions.',
  },
  {
    id: 'offset-overview',
    terms: ['offset', 'offset hours', 'offset balance', 'offset tracker', 'approved offset', 'earn offset'],
    en: 'Offset is approved time credit earned from eligible work after 7:00 PM. Earned offset requests require approval before they become available balance. Approved offset can be used for supported attendance corrections such as Late, or for a one-day Offset-funded Leave when at least 9 unreserved approved hours are available. Super Admin can also make audited manual hour/minute adjustments.',
    tl: 'Ang Offset ay approved time credit mula sa eligible work pagkatapos ng 7:00 PM. Kailangan munang ma-approve ang earned offset request bago ito maging available balance. Ang approved offset ay puwedeng gamitin sa supported attendance correction gaya ng Late, o sa isang araw na Offset-funded Leave kapag may hindi bababa sa 9 unreserved approved hours. Puwede ring gumawa ang Super Admin ng audited manual hour/minute adjustment.',
  },
  {
    id: 'offset-earning',
    terms: ['earn offset', 'how offset earned', 'paano maka offset', 'paano kumita offset', 'after 7 pm', '7 pm offset', 'overtime offset'],
    en: 'Eligible offset earning starts after 7:00 PM. The automatic earned request uses completed whole hours after 7:00 PM and remains pending until reviewed. Only approved earned time becomes part of the usable offset balance.',
    tl: 'Nagsisimula ang eligible offset earning pagkatapos ng 7:00 PM. Completed whole hours pagkatapos ng 7:00 PM ang ginagamit sa automatic earned request at Pending muna ito hanggang ma-review. Approved earned time lang ang nagiging usable offset balance.',
  },
  {
    id: 'offset-late',
    terms: ['offset late', 'use offset for late', 'late using offset', 'remove late offset', 'scrub late', 'offset applied'],
    en: 'You can request to use approved offset for an eligible Late attendance record. One Late correction uses 1 approved offset hour. The request goes to HR; the hour is deducted only when HR approves it, and the attendance status changes to Offset Applied.',
    tl: 'Puwede kang mag-request na gamitin ang approved offset sa eligible Late attendance record. Isang Late correction ay gumagamit ng 1 approved offset hour. Pupunta muna ito sa HR; mababawas lang ang 1 hour kapag inapprove ng HR at magiging Offset Applied ang attendance status.',
  },
  {
    id: 'offset-leave',
    terms: ['leave using offset', 'offset leave', 'leave with offset', '9 hours leave', '9 hrs leave', 'use offset for leave', 'offset funded leave'],
    en: 'Leave Using Offset is a one-day leave funded by 9 unreserved approved offset hours. The option is disabled when fewer than 9 unreserved approved hours are available. The 9 hours are not deducted when the request is filed; they are charged only after final HR approval. If an approved offset-funded leave is cancelled through an allowed cancellation flow, the charged offset is refunded automatically.',
    tl: 'Ang Leave Using Offset ay one-day leave na gumagamit ng 9 unreserved approved offset hours. Disabled ang option kapag kulang sa 9 unreserved approved hours. Hindi agad binabawas ang 9 hours sa pag-file; mababawas lang ito pagkatapos ng final HR approval. Kapag ang approved offset-funded leave ay na-cancel gamit ang allowed cancellation flow, automatic na mare-refund ang na-charge na offset.',
  },
  {
    id: 'offset-history',
    terms: ['offset history', 'history offset', 'earned offset history', 'used offset history', 'offset records'],
    en: 'The employee Offset module uses one combined Offset History so earned offset, Late usage, Offset Leave charges, and refunds can be reviewed in one chronological place instead of separate history sections.',
    tl: 'Isang combined Offset History na lang ang ginagamit sa employee Offset module para makita sa iisang chronological list ang earned offset, paggamit para sa Late, Offset Leave charges, at refunds.',
  },
  {
    id: 'early-timeout',
    terms: ['early time out', 'early timeout', 'time out early', 'maagang time out', 'offset early out', 'offset early time out'],
    en: 'Early Time Out currently uses the normal early-out confirmation flow. Offset is not automatically deducted for an early Time Out in the current rule. Manpower tracking still stops automatically when Time Out is recorded.',
    tl: 'Ang Early Time Out ay kasalukuyang gumagamit ng normal early-out confirmation flow. Hindi pa automatic na ginagamit o binabawas ang Offset para sa Early Time Out sa current rule. Automatic pa ring hihinto ang Manpower tracking kapag na-record ang Time Out.',
  },
  {
    id: 'leave-approval',
    terms: ['leave approval', 'associate leave', 'lead approval', 'direct lead', 'dual approval', 'leave hierarchy', 'associate lead hr', 'who approves leave', 'sino approve leave'],
    en: 'Leave approval depends on rank. An Associate request goes first to the employee’s assigned Direct Lead. Only after Lead approval does it enter the HR final-approval queue. If the Lead rejects it, it does not proceed to HR. A Lead’s own leave request goes directly to HR. HR/Admin manages employee Rank and Direct Lead assignments.',
    tl: 'Depende sa rank ang leave approval. Ang request ng Associate ay unang mapupunta sa assigned Direct Lead. Pag na-approve ng Lead saka lang ito papasok sa HR final-approval queue. Kapag ni-reject ng Lead, hindi na ito aabot sa HR. Ang sariling leave request ng Lead ay diretso sa HR. HR/Admin ang nagse-set ng Rank at Direct Lead ng employees.',
  },
  {
    id: 'leave-request',
    terms: ['request leave', 'file leave', 'new leave', 'how to leave', 'paano mag leave', 'leave request process'],
    en: 'Open Leave and file a new request by choosing the leave type, start date, end date, and reason. The portal applies the configured approval route. Regular leave uses the applicable leave-credit rules, while Leave Using Offset is a separate one-day option funded by 9 approved unreserved offset hours.',
    tl: 'Buksan ang Leave at mag-file ng request gamit ang leave type, start date, end date, at reason. Susundin ng portal ang configured approval route. Ang regular leave ay gumagamit ng applicable leave-credit rules, habang hiwalay na one-day option ang Leave Using Offset na gumagamit ng 9 approved unreserved offset hours.',
  },
  {
    id: 'leave-cancel',
    terms: ['cancel leave', 'leave cancellation', 'cancel approved leave', 'refund leave offset', 'cancel offset leave'],
    en: 'Leave cancellation depends on whether the portal allows cancellation for that request state. For an Offset-funded Leave that has already charged 9 hours, an allowed cancellation automatically refunds the charged offset balance. Pending requests do not consume the 9 hours; they only reserve availability.',
    tl: 'Depende sa request state kung pinapayagan ng portal ang leave cancellation. Para sa Offset-funded Leave na na-charge na ng 9 hours, automatic na ibabalik ang charged offset kapag pinayagang ma-cancel. Ang Pending request ay hindi pa kumakain ng 9 hours; nirereserve lang nito ang availability.',
  },
  {
    id: 'time-in-out',
    terms: ['time in', 'time out', 'clock in', 'clock out', 'attendance button', 'office network'],
    en: 'Time In and Time Out are attendance actions for the signed-in employee. In production they are restricted to the authorized office network. Time Out closes the active attendance shift and also stops any active Manpower project session.',
    tl: 'Ang Time In at Time Out ay attendance actions para sa signed-in employee. Sa production, restricted ang mga ito sa authorized office network. Kapag nag-Time Out, magsasara ang active attendance shift at automatic ding hihinto ang active Manpower project session.',
  },
  {
    id: 'attendance-status',
    terms: ['attendance status', 'present status', 'late status', 'absent status', 'offset applied status', 'attendance meaning'],
    en: 'Attendance status comes from the saved attendance record. Present means recorded present; Late means present but late-tagged; Absent means explicitly marked absent; Leave means covered by an approved leave/status; Offset Applied means an approved offset request was applied to the supported attendance issue. A missing log is not automatically treated as Absent by Ask AI.',
    tl: 'Ang attendance status ay galing sa saved attendance record. Present ay recorded present; Late ay present pero late-tagged; Absent ay explicit na marked absent; Leave ay covered ng approved leave/status; Offset Applied ay may approved offset request na na-apply sa supported attendance issue. Hindi automatic na Absent ang missing log sa Ask AI.',
  },
  {
    id: 'attendance-dispute',
    terms: ['attendance dispute', 'file dispute', 'wrong attendance', 'missing log', 'report missing log', 'incorrect time in', 'incorrect time out'],
    en: 'For an incorrect attendance record, open Attendance or My Disputes and file a dispute for the affected date. For a missing Time In or Time Out, use Report Missing Log and submit the missing date/time plus a reason. HR reviews the request before the record is corrected.',
    tl: 'Para sa maling attendance record, buksan ang Attendance o My Disputes at mag-file ng dispute para sa affected date. Para sa missing Time In o Time Out, gamitin ang Report Missing Log at ilagay ang missing date/time at reason. HR muna ang magre-review bago ma-correct ang record.',
  },
  {
    id: 'payslip',
    terms: ['payslip', 'my payslip', 'salary pdf', 'payslip password', 'payslip ai', 'deductions payslip'],
    en: 'Published payslips are available under My Payslips. Ask AI can answer questions about your own latest or selected published payslip. Before AI reads payslip details, the portal requires short-lived password confirmation. The password is verified by Supabase and is not sent to n8n or Gemini.',
    tl: 'Makikita ang published payslips sa My Payslips. Kayang sagutin ng Ask AI ang tanong tungkol sa sarili mong latest o selected published payslip. Bago basahin ng AI ang payslip details, kailangan ng short-lived password confirmation. Supabase ang nagve-verify ng password at hindi ito ipinapadala sa n8n o Gemini.',
  },
  {
    id: 'directory',
    terms: ['employee directory', 'work email', 'company email', 'find employee', 'directory'],
    en: 'The employee directory exposes approved work information for active employees, such as full name, designation, and work email. Ask AI must not reveal another employee’s private attendance, leave, salary, payslip, government IDs, personal email, phone, or address.',
    tl: 'Ang employee directory ay nagbibigay lang ng approved work information ng active employees gaya ng full name, designation, at work email. Hindi puwedeng ilabas ng Ask AI ang private attendance, leave, salary, payslip, government IDs, personal email, phone, o address ng ibang employee.',
  },
  {
    id: 'account-creation',
    terms: ['create account', 'add account', 'new employee account', 'who creates account', 'sino create account', 'super admin account'],
    en: 'Employee account creation is restricted to Super Admin. HR/Admin can manage the HR workflows assigned to them, but account creation remains a Super Admin function.',
    tl: 'Super Admin lang ang puwedeng gumawa ng employee account. Puwedeng i-manage ng HR/Admin ang assigned HR workflows nila, pero Super Admin function pa rin ang account creation.',
  },
  {
    id: 'hr-offset-tools',
    terms: ['hr offset', 'offset management hr', 'offset notification', 'leave hierarchy hr', 'hr quick action', 'hr sidebar'],
    en: 'In the HR/Admin dashboard, Offset Management and Leave Hierarchy are available from the sidebar and Quick Actions. Pending Offset actions are also included in the HR notification/action center. These tools are not floating launchers.',
    tl: 'Sa HR/Admin dashboard, available ang Offset Management at Leave Hierarchy sa sidebar at Quick Actions. Kasama rin ang pending Offset actions sa HR notification/action center. Hindi floating launchers ang mga tool na ito.',
  },
  {
    id: 'notifications',
    terms: ['notification', 'notifications', 'announcement', 'announcements', 'holiday', 'birthday', 'action center'],
    en: 'The portal can show announcements, holidays, birthdays, attention cards, and workflow notifications. HR’s notification/action center also includes pending Offset actions alongside other review items when available.',
    tl: 'Puwedeng magpakita ang portal ng announcements, holidays, birthdays, attention cards, at workflow notifications. Kasama rin sa HR notification/action center ang pending Offset actions kasama ng ibang review items kapag available.',
  },
  {
    id: 'commute',
    terms: ['commute', 'plan my commute', 'route weather', 'traffic', 'departure advice'],
    en: 'Plan My Commute checks a selected From/To route using the chosen departure date/time, route weather, rain risk, traffic information, and departure guidance. It works best when exact address suggestions are selected.',
    tl: 'Ang Plan My Commute ay nagche-check ng selected From/To route gamit ang departure date/time, route weather, rain risk, traffic information, at departure guidance. Mas accurate ito kapag exact address suggestion ang pinili.',
  },
  {
    id: 'profile',
    terms: ['edit profile', 'profile update', 'change profile', 'my profile'],
    en: 'Use Profile → Edit Profile for fields the employee portal allows you to change. Core employment details, role, payroll data, government IDs, ranking, and other restricted fields are managed by the appropriate HR/Admin or Super Admin workflow rather than by the employee.',
    tl: 'Gamitin ang Profile → Edit Profile para sa fields na pinapayagang baguhin ng employee portal. Ang core employment details, role, payroll data, government IDs, ranking, at ibang restricted fields ay mina-manage ng tamang HR/Admin o Super Admin workflow at hindi ng employee.',
  },
  {
    id: 'theme-navigation',
    terms: ['dark mode', 'light mode', 'theme', 'sidebar', 'bottom navigation', 'all tools', 'navigation'],
    en: 'The portal supports light and dark mode and responsive navigation. On desktop, use the sidebar and dashboard Quick Actions. On mobile/tablet, use the bottom navigation or More/All Tools sheet for available modules.',
    tl: 'May light at dark mode at responsive navigation ang portal. Sa desktop, gamitin ang sidebar at dashboard Quick Actions. Sa mobile/tablet, gamitin ang bottom navigation o More/All Tools sheet para sa available modules.',
  },
  {
    id: 'ask-ai-privacy',
    terms: ['ask ai privacy', 'ai privacy', 'what can ai see', 'ano nakikita ai', 'other employee data', 'ask ai security'],
    en: 'Ask AI uses the authenticated Supabase session as the identity source. A name, email, employee number, or identity claim typed in chat cannot change authorization. Private database answers are scoped to the signed-in employee’s allowed records, while approved directory information may be returned for other active employees.',
    tl: 'Ginagamit ng Ask AI ang authenticated Supabase session bilang identity source. Hindi mababago ng pangalan, email, employee number, o identity claim na tinype sa chat ang authorization. Ang private database answers ay naka-scope sa allowed records ng signed-in employee, habang approved directory information lang ang puwedeng ibigay tungkol sa ibang active employees.',
  },
];

const normalize = (value: string) => value
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s:/-]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const explanatory = /\b(how|why|where|what is|what does|can i|when can|rule|rules|process|workflow|meaning|works?|disabled|available|paano|bakit|saan|ano ang|ano ibig sabihin|pwede ba|maaari ba|kailan pwede|paano gumagana)\b/i;
const livePersonal = /\b(how many|how much|my current|my remaining|my pending|my latest|what is my balance|who is my|ilan|magkano|balance ko|remaining ko|natitira ko|pending ko|status ng .* ko|sino (ang )?.* ko|time in ko|time out ko|attendance ko today|leave balance ko)\b/i;

function scoreEntry(question: string, entry: Entry) {
  let score = 0;
  for (const term of entry.terms) {
    const normalizedTerm = normalize(term);
    if (!normalizedTerm) continue;
    if (question.includes(normalizedTerm)) score += normalizedTerm.includes(' ') ? 4 : 2;
  }
  return score;
}

export function answerKnownSystemQuestion(question: string, language: Language): string | null {
  const normalized = normalize(question);
  if (!normalized || livePersonal.test(normalized)) return null;

  let best: Entry | null = null;
  let bestScore = 0;
  for (const entry of ENTRIES) {
    const score = scoreEntry(normalized, entry);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  const hasSystemCue = explanatory.test(normalized);
  if (!best || bestScore < 4 || (!hasSystemCue && bestScore < 6)) return null;

  const tagalogCue = /\b(ang|ano|bakit|paano|saan|pwede|maaari|ko|ako|akin|kailan|hindi|di|gamit|leave|offset)\b/i.test(normalized);
  const useTl = language === 'tl' || (language === 'auto' && tagalogCue);
  return useTl ? best.tl : best.en;
}
