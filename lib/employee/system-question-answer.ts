type Language = 'auto' | 'tl' | 'en';
type Entry = { terms: string[]; en: string; tl: string };

const ENTRIES: Entry[] = [
  {
    terms: ['what can ask ai do', 'what can ai help with', 'ask ai help', 'ask ai capabilities', 'ano pwede itanong sa ask ai', 'ano puwede itanong sa ask ai', 'ano kayang sagutin ng ask ai', 'ano kaya ng ask ai'],
    en: 'Ask AI can help you understand your own attendance, attendance streak, leave, Offset, upcoming company holidays, profile and published payslip information, explain portal workflows, and find approved work-directory details for active employees. Your private answers stay limited to your signed-in account. Ask AI cannot reveal another employee’s private attendance, leave, salary, payslip, personal email, phone, address, IDs, or passwords.',
    tl: 'Makakatulong ang Ask AI sa pag-intindi ng sarili mong attendance, attendance streak, leave, Offset, susunod na company holidays, profile at published payslip, sa portal workflows, at sa approved work-directory details ng active employees. Ang private answers ay limitado sa sarili mong signed-in account. Hindi nito puwedeng ibigay ang private attendance, leave, salary, payslip, personal email, phone, address, IDs o passwords ng ibang employee.',
  },
  {
    terms: ['manpower tracker', 'project tracker', 'time tracker', 'project timer', 'track project', 'project hours'],
    en: 'After Time In, you can pre-select a Manpower project before 9:00 AM; tracking begins automatically at 9:00 AM Manila time. It pauses automatically from 12:00 PM to 1:00 PM, resumes the same project at 1:00 PM only if the shift is still open, and closes at 7:00 PM or Time Out, whichever comes first. Switching projects stops the previous project and starts the new one.',
    tl: 'Pagkatapos ng Time In, puwede nang mag-pre-select ng Manpower project bago mag-9:00 AM; automatic magsisimula ang tracking ng 9:00 AM Manila time. Automatic itong magpa-pause ng 12:00 PM–1:00 PM, magre-resume sa parehong project ng 1:00 PM kung open pa ang shift, at hihinto sa 7:00 PM o sa Time Out, alinman ang mauna. Kapag nag-switch ng project, hihinto ang nauna at magsisimula ang bago.',
  },
  {
    terms: ['tracker locked', 'tracker disabled', 'cannot start tracker', "can't start tracker", 'di ma start tracker', 'hindi ma start tracker', 'before 9', '9 am tracker', 'active shift tracker'],
    en: 'Before Time In, during the 12:00 PM–1:00 PM lunch break, after 7:00 PM, and after Time Out, the tracker is locked. Before 9:00 AM you can pre-select a project after Time In, but no time is recorded until 9:00 AM.',
    tl: 'Naka-lock ang tracker bago mag-Time In, habang 12:00 PM–1:00 PM lunch break, pagkatapos ng 7:00 PM, at pagkatapos mag-Time Out. Bago mag-9:00 AM, puwede kang mag-pre-select ng project pagkatapos ng Time In, pero walang mare-record na oras hanggang 9:00 AM.',
  },
  {
    terms: ['manpower project', 'tracker project list', 'project list tracker', 'add tracker project', 'who adds project', 'super admin project'],
    en: 'Employees choose from active Manpower projects created by Super Admin. Super Admin can add a project, optionally set a project code, and activate or deactivate it while historical tracked sessions remain preserved.',
    tl: 'Pumipili ang employee mula sa active Manpower projects na ginawa ng Super Admin. Puwedeng mag-add ang Super Admin ng project, optional project code, at mag-activate o mag-deactivate habang preserved ang historical tracked sessions.',
  },
  {
    terms: ['offset', 'offset hours', 'offset tracker', 'approved offset', 'earn offset', 'how does offset work', 'how offset works', 'what is offset', 'ano ang offset', 'paano gumagana ang offset', 'paano ang offset', 'explain offset', 'ipaliwanag ang offset', 'offset works'],
    en: 'Offset is approved time credit from eligible work after 7:00 PM. Earned requests must be approved before becoming usable balance. Only completed whole hours count: 7:59 PM earns 0 hours, while 8:00 PM earns 1 hour. On approval, the eligible OT time is assigned to the employee’s final project at the 7:00 PM cutoff. During the active payroll cutoff only (1–15 or 16–month-end), approved Offset can correct Late, exact-minute Early Out, or one full Absent day for 9 hours. A one-day Leave Using Offset also needs 9 unreserved approved hours. Super Admin can make audited manpower-time adjustments for past records.',
    tl: 'Ang Offset ay approved time credit mula sa eligible work pagkatapos ng 7:00 PM. Kailangan munang ma-approve ang earned request bago maging usable balance. Buong oras lang ang binibilang: 7:59 PM ay 0 oras, habang 8:00 PM ay 1 oras. Kapag na-approve, ang eligible OT time ay ia-assign sa huling project ng employee sa 7:00 PM cutoff. Sa active payroll cutoff lang (1–15 o 16–month-end), puwedeng gamitin ang approved Offset para sa Late, exact-minute Early Out, o isang full-day Absent na 9 oras. Ang one-day Leave Using Offset ay kailangan din ng 9 unreserved approved hours. Puwede ring gumawa ang Super Admin ng audited manpower-time adjustment para sa past records.',
  },
  {
    terms: ['earn offset', 'how offset earned', '7 pm offset', '7:30 pm offset', 'after 7 pm', 'after 7:30 pm', 'paano maka offset', 'paano kumita offset'],
    en: 'Automatic offset earning uses completed whole hours after 7:00 PM. The earned request remains pending until reviewed, and only approved earned time becomes usable offset balance.',
    tl: 'Completed whole hours pagkatapos ng 7:00 PM ang ginagamit sa automatic offset earning. Pending muna ang earned request hanggang ma-review, at approved earned time lang ang nagiging usable offset balance.',
  },
  {
    terms: ['offset late', 'use offset for late', 'late using offset', 'scrub late', 'offset applied'],
    en: 'An eligible Late record in the active payroll cutoff can use the exact number of approved offset minutes needed after 9:00 AM. The request goes to HR, is deducted only after approval, and the attendance tag changes to Offset.',
    tl: 'Ang eligible Late record sa active payroll cutoff ay puwedeng gumamit ng eksaktong approved Offset minutes na kailangan pagkatapos ng 9:00 AM. Pupunta muna ang request sa HR, mababawas lang pagkatapos ma-approve, at magiging Offset ang attendance tag.',
  },
  {
    terms: ['offset absent', 'use offset for absent', 'scrub absent', 'absent using offset', 'absent offset'],
    en: 'An Absent record in the active payroll cutoff can be scrubbed with 9 unreserved approved Offset hours. The request is reserved while pending, deducted only after HR approval, and then changes the attendance tag to Offset.',
    tl: 'Ang Absent record sa active payroll cutoff ay puwedeng i-scrub gamit ang 9 unreserved approved Offset hours. Reserved lang ito habang Pending, mababawas lang pagkatapos ma-approve ng HR, at magiging Offset ang attendance tag.',
  },
  {
    terms: ['leave using offset', 'offset leave', 'leave with offset', '9 hours leave', '9 hrs leave', 'offset funded leave'],
    en: 'Leave Using Offset is a one-day leave funded by 9 unreserved approved offset hours. It is disabled below 9 available hours. The 9 hours are reserved while pending and deducted only after final HR approval. If an already charged offset-funded leave is cancelled through an allowed cancellation flow, the charged offset is refunded automatically.',
    tl: 'Ang Leave Using Offset ay one-day leave na gumagamit ng 9 unreserved approved offset hours. Disabled ito kapag below 9 available hours. Reserved lang ang 9 hours habang Pending at mababawas lang pagkatapos ng final HR approval. Kapag na-cancel sa allowed cancellation flow ang na-charge nang offset-funded leave, automatic na mare-refund ang offset.',
  },
  {
    terms: ['offset history', 'history offset', 'earned offset history', 'used offset history', 'offset records'],
    en: 'The employee Offset module uses one combined Offset History for earned offset, Late usage, Early Out usage, Absent usage, Offset Leave charges, and refunds, shown in one chronological list.',
    tl: 'Isang combined Offset History ang ginagamit para sa earned offset, Late usage, Early Out usage, Absent usage, Offset Leave charges, at refunds sa iisang chronological list.',
  },
  {
    terms: ['early time out', 'early timeout', 'time out early', 'maagang time out', 'offset early out', 'offset early time out', 'use offset early out'],
    en: 'Before the official Time Out cutoff, the Early Time Out confirmation offers Use Offset. The system reserves the exact early minutes from your unreserved approved Offset balance, records Time Out immediately, and stops Manpower tracking. HR approval deducts the reserved minutes; rejection deducts nothing.',
    tl: 'Bago ang official Time Out cutoff, may Use Offset option sa Early Time Out confirmation. Ire-reserve ng system ang eksaktong early minutes mula sa unreserved approved Offset balance, mare-record agad ang Time Out, at hihinto ang Manpower tracking. Kapag approved ng HR, mababawas ang reserved minutes; kapag rejected, walang deduction.',
  },
  {
    terms: ['leave approval', 'associate leave', 'lead approval', 'direct lead', 'dual approval', 'leave hierarchy', 'associate lead hr', 'who approves leave', 'sino approve leave'],
    en: 'An Associate leave request goes first to the assigned Direct Lead, then to HR for final approval. A Lead rejection ends the request before HR. A Lead’s own leave request goes directly to HR. HR/Admin manages Rank and Direct Lead assignments.',
    tl: 'Ang leave request ng Associate ay mapupunta muna sa assigned Direct Lead, saka sa HR para sa final approval. Kapag rejected ng Lead, hindi na ito aabot sa HR. Ang sariling leave ng Lead ay diretso sa HR. HR/Admin ang nagse-set ng Rank at Direct Lead.',
  },
  {
    terms: ['request leave', 'file leave', 'new leave', 'how to leave', 'paano mag leave', 'leave request process'],
    en: 'Open Leave, choose the leave type, start date, end date and reason, then submit. The portal follows the configured approval route. Regular leave uses applicable leave-credit rules; Leave Using Offset is a separate one-day option using 9 approved unreserved offset hours.',
    tl: 'Buksan ang Leave, piliin ang leave type, start date, end date at reason, tapos submit. Susundin ng portal ang configured approval route. Regular leave uses applicable leave credits; hiwalay ang one-day Leave Using Offset na gumagamit ng 9 approved unreserved offset hours.',
  },
  {
    terms: ['cancel leave', 'leave cancellation', 'cancel approved leave', 'refund leave offset', 'cancel offset leave'],
    en: 'Cancellation depends on the request state allowed by the portal. A pending Offset Leave has not consumed the 9 hours yet; it only reserves them. If an approved Offset Leave has already charged the 9 hours and an allowed cancellation is completed, the offset is refunded automatically.',
    tl: 'Depende sa request state kung puwedeng i-cancel. Ang Pending Offset Leave ay hindi pa kumakain ng 9 hours; reserved lang iyon. Kapag na-charge na ang 9 hours sa approved Offset Leave at successful ang allowed cancellation, automatic na mare-refund ang offset.',
  },
  {
    terms: ['time in', 'time out', 'clock in', 'clock out', 'office network', 'attendance button'],
    en: 'Time In and Time Out are recorded for the signed-in employee and, in production, are restricted to the authorized office network. Time Out closes the shift and automatically stops an active Manpower project session.',
    tl: 'Ang Time In at Time Out ay para sa signed-in employee at, sa production, restricted sa authorized office network. Ang Time Out ay nagsasara ng shift at automatic na humihinto ang active Manpower project session.',
  },
  {
    terms: ['attendance status', 'present status', 'late status', 'absent status', 'offset applied status', 'attendance meaning'],
    en: 'Present means recorded present, Late means present but late-tagged, Absent means explicitly marked absent, Leave means covered by approved leave/status, and Offset means an approved offset correction was applied. A missing log is not automatically treated as Absent by Ask AI.',
    tl: 'Present ay recorded present, Late ay present pero late-tagged, Absent ay explicit na marked absent, Leave ay covered ng approved leave/status, at Offset ay may approved offset correction. Hindi automatic na Absent ang missing log sa Ask AI.',
  },
  {
    terms: ['attendance dispute', 'file dispute', 'wrong attendance', 'missing log', 'report missing log', 'incorrect time in', 'incorrect time out'],
    en: 'For an incorrect attendance record, open Attendance or My Disputes and file a dispute. For missing Time In or Time Out, use Report Missing Log with the missing date/time and reason. HR reviews it before correction.',
    tl: 'Para sa maling attendance record, buksan ang Attendance o My Disputes at mag-file ng dispute. Para sa missing Time In o Time Out, gamitin ang Report Missing Log at ilagay ang missing date/time at reason. HR muna ang magre-review bago ma-correct.',
  },
  {
    terms: ['payslip', 'my payslip', 'salary pdf', 'payslip password', 'payslip ai', 'deductions payslip'],
    en: 'Published payslips are under My Payslips. Ask AI can answer questions about your own latest or selected payslip. Password confirmation is required before AI reads payslip details; Supabase verifies the password, and the password is not sent to n8n or Gemini.',
    tl: 'Makikita ang published payslips sa My Payslips. Kayang sagutin ng Ask AI ang tanong tungkol sa sarili mong latest o selected payslip. Kailangan ng password confirmation bago basahin ng AI ang payslip details; Supabase ang nagve-verify at hindi ipinapadala ang password sa n8n o Gemini.',
  },
  {
    terms: ['employee directory', 'work email', 'company email', 'find employee', 'directory'],
    en: 'The directory may return approved work information for active employees: full name, designation and work email. Ask AI must not reveal another employee’s private attendance, leave, salary, payslip, government IDs, personal email, phone or address.',
    tl: 'Approved work information lang ng active employees ang puwedeng ibigay ng directory: full name, designation at work email. Hindi puwedeng ilabas ang private attendance, leave, salary, payslip, government IDs, personal email, phone o address ng ibang employee.',
  },
  {
    terms: ['create account', 'add account', 'new employee account', 'who creates account', 'sino create account'],
    en: 'Only Super Admin creates employee accounts. HR/Admin handles its assigned HR workflows but does not create accounts.',
    tl: 'Super Admin lang ang gumagawa ng employee accounts. HR/Admin ang humahawak ng assigned HR workflows pero hindi account creation.',
  },
  {
    terms: ['hr offset', 'offset management hr', 'offset notification', 'leave hierarchy hr', 'hr quick action', 'hr sidebar'],
    en: 'HR/Admin has Offset Management and Leave Hierarchy in the sidebar and Quick Actions. Pending Offset actions are also included in the HR notification/action center. These are not floating launchers.',
    tl: 'May Offset Management at Leave Hierarchy ang HR/Admin sa sidebar at Quick Actions. Kasama rin ang pending Offset actions sa HR notification/action center. Hindi floating launchers ang mga ito.',
  },
  {
    terms: ['company calendar', 'holiday calendar', 'holiday list', 'holidays ko', 'company holidays', 'walang pasok', 'non working day', 'no work day'],
    en: 'The Company Calendar shows the holidays HR has set up, one-off or recurring. Ask AI can also tell you the next company holiday and the days remaining before it.',
    tl: 'Ipinapakita ng Company Calendar ang mga holiday na naka-set ng HR. Kayang sabihin ng Ask AI ang susunod na company holiday at kung ilang araw na lang bago ito.',
  },
  {
    terms: ['attendance streak', 'my streak', 'streak ko', 'consecutive work day', 'how long streak'],
    en: 'Your attendance streak counts consecutive work days with no Late or Absent tag; approved Leave days are skipped, not counted or broken. It is shown as the Day Streak card on your dashboard and Ask AI can read it for you.',
    tl: 'Ang attendance streak mo ay bilang ng magkasunod na work days nang walang Late o Absent tag; hindi binibilang o pinuputol ng approved Leave. Ipinapakita ito bilang Day Streak card sa dashboard mo at kayang basahin ng Ask AI.',
  },
  {
    terms: ['notification', 'notifications', 'announcement', 'announcements', 'holiday', 'birthday', 'action center'],
    en: 'The portal can show announcements, holidays, birthdays, attention cards and workflow notifications. HR’s action center also includes pending Offset actions when available.',
    tl: 'Puwedeng magpakita ang portal ng announcements, holidays, birthdays, attention cards at workflow notifications. Kasama rin sa HR action center ang pending Offset actions kapag available.',
  },
  {
    terms: ['commute', 'plan my commute', 'route weather', 'traffic', 'departure advice'],
    en: 'Plan My Commute checks a selected route using exact From/To addresses, departure date/time, route weather, rain risk, traffic and departure guidance. Exact address suggestions give better results.',
    tl: 'Ang Plan My Commute ay nagche-check ng route gamit ang exact From/To addresses, departure date/time, route weather, rain risk, traffic at departure guidance. Mas accurate kapag exact address suggestion ang pinili.',
  },
  {
    terms: ['edit profile', 'profile update', 'change profile', 'my profile'],
    en: 'Use Profile → Edit Profile for fields the employee can change. Core employment details, role, payroll data, government IDs, ranking and other restricted fields are managed through the appropriate HR/Admin or Super Admin workflow.',
    tl: 'Gamitin ang Profile → Edit Profile para sa fields na puwedeng baguhin ng employee. Ang core employment details, role, payroll data, government IDs, ranking at ibang restricted fields ay mina-manage sa tamang HR/Admin o Super Admin workflow.',
  },
  {
    terms: ['dark mode', 'light mode', 'theme', 'sidebar', 'bottom navigation', 'all tools', 'navigation'],
    en: 'The portal supports light/dark mode and responsive navigation. Desktop uses the sidebar and Quick Actions; mobile/tablet uses bottom navigation or More/All Tools for available modules.',
    tl: 'May light/dark mode at responsive navigation ang portal. Sa desktop, gamitin ang sidebar at Quick Actions; sa mobile/tablet, gamitin ang bottom navigation o More/All Tools.',
  },
  {
    terms: ['ask ai privacy', 'ai privacy', 'what can ai see', 'ano nakikita ai', 'other employee data', 'ask ai security'],
    en: 'Ask AI uses the authenticated Supabase session as identity. Names, emails or IDs typed in chat cannot change authorization. Private answers are scoped to the signed-in employee; only approved directory fields may be returned for other active employees.',
    tl: 'Ginagamit ng Ask AI ang authenticated Supabase session bilang identity. Hindi mababago ng pangalan, email o ID na tinype sa chat ang authorization. Sariling allowed records lang ang private answers; approved directory fields lang ang puwedeng ibigay para sa ibang active employees.',
  },
];

const normalize = (value: string) => value
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s:/-]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const EXPLANATORY = /\b(how|why|where|what is|what does|what can|can i|when can|rule|rules|process|workflow|meaning|works?|disabled|available|paano|bakit|saan|ano ang|ano ibig sabihin|ano puwede|pwede ba|maaari ba|kailan pwede|paano gumagana)\b/i;
const LIVE_PERSONAL = /\b(how many|how much|my current|my remaining|my pending|my latest|what is my balance|who is my|ilan|magkano|balance ko|remaining ko|natitira ko|pending ko|status ng .* ko|sino (ang )?.* ko|time in ko|time out ko|attendance ko today|leave balance ko)\b/i;

function score(question: string, entry: Entry) {
  return entry.terms.reduce((total, term) => {
    const t = normalize(term);
    return question.includes(t) ? total + (t.includes(' ') ? 4 : 2) : total;
  }, 0);
}

export function answerKnownSystemQuestion(question: string, language: Language): string | null {
  const q = normalize(question);
  if (!q || LIVE_PERSONAL.test(q)) return null;
  let best: Entry | null = null;
  let bestScore = 0;
  for (const entry of ENTRIES) {
    const value = score(q, entry);
    if (value > bestScore) { best = entry; bestScore = value; }
  }
  if (!best || bestScore < 4 || (!EXPLANATORY.test(q) && bestScore < 6)) return null;
  const tagalog = /\b(ang|ano|bakit|paano|saan|pwede|maaari|ko|ako|akin|kailan|hindi|di|gamit)\b/i.test(q);
  return language === 'tl' || (language === 'auto' && tagalog) ? best.tl : best.en;
}
