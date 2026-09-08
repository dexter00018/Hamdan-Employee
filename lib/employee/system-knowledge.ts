export type SystemKnowledgeMetric =
  | 'dashboard_overview'
  | 'timeinout_location'
  | 'attendance_history'
  | 'attendance_statuses'
  | 'dispute_process'
  | 'missing_log_process'
  | 'leave_request_process'
  | 'leave_credits'
  | 'leave_history'
  | 'payslip_access'
  | 'payslip_ai_security'
  | 'commute_planner'
  | 'profile_update'
  | 'directory_lookup'
  | 'privacy_rules'
  | 'notifications_announcements'
  | 'theme_display'
  | 'hr_workflows_overview'
  | 'admin_workflows_overview'
  | 'general_navigation';

export const SYSTEM_KNOWLEDGE: Record<SystemKnowledgeMetric, { en: string; tl: string }> = {
  dashboard_overview: {
    en: 'The employee Dashboard is the main home screen. It shows your current work status, quick actions, attendance shortcuts, leave and payslip access, commute planning, announcements, holidays, birthdays, and other employee tools available to your account.',
    tl: 'Ang employee Dashboard ang main home screen. Makikita rito ang current work status mo, quick actions, attendance shortcuts, leave at payslip access, commute planning, announcements, holidays, birthdays, at ibang employee tools na available sa account mo.',
  },
  timeinout_location: {
    en: 'Use the Time In / Time Out action on the employee Dashboard. The portal records the timestamp for your signed-in account. If location or network validation is enabled, follow the prompt before submitting.',
    tl: 'Gamitin ang Time In / Time Out action sa employee Dashboard. Itinatala ng portal ang timestamp para sa signed-in account mo. Kung naka-enable ang location o network validation, sundin muna ang prompt bago mag-submit.',
  },
  attendance_history: {
    en: 'Open Attendance or Attendance History to review your own daily logs, status tags, time-in, and time-out records. Ask AI can summarize your own attendance by date range, month, current year, or supported payroll period when records exist.',
    tl: 'Buksan ang Attendance o Attendance History para makita ang sarili mong daily logs, status tags, time-in, at time-out records. Kayang i-summarize ng Ask AI ang sarili mong attendance by date range, month, current year, o supported payroll period kapag may records.',
  },
  attendance_statuses: {
    en: 'Attendance statuses are based on the saved status tag. Present means recorded as present, Late means present but tagged late, Absent means explicitly tagged absent, and Leave means the day is covered by an approved leave/status. Days with no log are not automatically counted as Absent by Ask AI.',
    tl: 'Ang attendance status ay base sa saved status tag. Present ibig sabihin recorded as present, Late ibig sabihin present pero late-tagged, Absent ibig sabihin explicit na naka-tag as absent, at Leave ibig sabihin covered ng approved leave/status. Hindi automatic na Absent ang araw na walang log sa Ask AI.',
  },
  dispute_process: {
    en: 'To file a dispute, open Attendance, choose the record or date with an incorrect tag/time, then use File Dispute. Add the reason and submit it for HR review. Approved disputes update or explain the attendance record depending on HR action.',
    tl: 'Para mag-file ng dispute, buksan ang Attendance, piliin ang record o date na may maling tag/time, tapos gamitin ang File Dispute. Ilagay ang reason at i-submit para sa HR review. Kapag approved, maa-update o mae-explain ang attendance record depende sa HR action.',
  },
  missing_log_process: {
    en: 'For a missing time-in or time-out, open My Disputes or Attendance, choose Report Missing Log, enter the missing date/time and reason, then submit. HR reviews the request before the record is corrected.',
    tl: 'Para sa missing time-in o time-out, buksan ang My Disputes o Attendance, piliin ang Report Missing Log, ilagay ang missing date/time at reason, tapos i-submit. HR muna ang magre-review bago ma-correct ang record.',
  },
  leave_request_process: {
    en: 'To request leave, open Leave, click New Leave Request, choose the leave type, start date, end date, and reason, then submit. The portal estimates chargeable working days and excludes configured holidays where applicable. HR or an approver reviews the request.',
    tl: 'Para mag-request ng leave, buksan ang Leave, i-click ang New Leave Request, piliin ang leave type, start date, end date, at reason, tapos i-submit. Ine-estimate ng portal ang chargeable working days at ine-exclude ang configured holidays kung applicable. HR o approver ang magre-review.',
  },
  leave_credits: {
    en: 'Leave credits show your yearly allocation, used credits, and remaining balance. Regular employees usually have tracked credits; other employment statuses may still file leave but can have different credit handling based on HR rules.',
    tl: 'Makikita sa leave credits ang yearly allocation mo, used credits, at remaining balance. Karaniwang tracked ang credits ng regular employees; ibang employment status ay puwedeng mag-file ng leave pero maaaring iba ang credit handling depende sa HR rules.',
  },
  leave_history: {
    en: 'My Leave Requests shows your submitted leave requests, dates, type, status, reason, HR notes when available, filed time, and resolved time. Pending requests can be reviewed or cancelled only when the portal allows it.',
    tl: 'Makikita sa My Leave Requests ang submitted leave requests mo, dates, type, status, reason, HR notes kung meron, filed time, at resolved time. Pending requests lang ang puwedeng i-review o i-cancel kapag pinapayagan ng portal.',
  },
  payslip_access: {
    en: 'Open My Payslips to view published payslips from HR. Ask AI can answer questions about your own latest or selected payslip, such as deductions, gross pay, basic pay for the cutoff, and net pay. It does not provide downloadable PDFs inside chat.',
    tl: 'Buksan ang My Payslips para makita ang published payslips mula HR. Kayang sagutin ng Ask AI ang tanong tungkol sa sarili mong latest o selected payslip, tulad ng deductions, gross pay, basic pay para sa cutoff, at net pay. Hindi ito nagbibigay ng downloadable PDFs sa chat.',
  },
  payslip_ai_security: {
    en: 'Payslip questions require password confirmation before Ask AI reads the PDF. The password is verified by Supabase and is not sent to n8n or Gemini. The unlock is short-lived and applies only to the signed-in employee’s own payslips.',
    tl: 'Kailangan ng password confirmation bago basahin ng Ask AI ang payslip PDF. Vine-verify ang password sa Supabase at hindi ito ipinapadala sa n8n o Gemini. Short-lived ang unlock at para lang sa sariling payslips ng signed-in employee.',
  },
  commute_planner: {
    en: 'Plan My Commute helps check a selected route using exact From and To addresses, departure date/time, route weather, rain risk, traffic delays, and best departure advice. Address search is focused on the Philippines and works best when you pick exact suggestions.',
    tl: 'Ang Plan My Commute ay tumutulong mag-check ng selected route gamit ang exact From at To addresses, departure date/time, route weather, rain risk, traffic delays, at best departure advice. Philippines-focused ang address search at mas accurate kapag exact suggestion ang pinili.',
  },
  profile_update: {
    en: 'Open Profile and choose Edit Profile to update fields the portal allows you to edit. Core employment details, role, government IDs, payroll data, and other restricted profile fields must be handled by HR or an admin.',
    tl: 'Buksan ang Profile at piliin ang Edit Profile para i-update ang fields na pinapayagan ng portal. Core employment details, role, government IDs, payroll data, at ibang restricted profile fields ay kailangang idaan sa HR o admin.',
  },
  directory_lookup: {
    en: 'Ask AI can help with approved work-directory information for active employees, such as full name, designation, and work email. It cannot share private employee records like salary, payslips, attendance, leave details, government IDs, personal email, phone, or address.',
    tl: 'Makakatulong ang Ask AI sa approved work-directory information ng active employees, tulad ng full name, designation, at work email. Hindi ito puwedeng mag-share ng private employee records tulad ng salary, payslips, attendance, leave details, government IDs, personal email, phone, o address.',
  },
  privacy_rules: {
    en: 'Ask AI uses the signed-in Supabase session as the identity source. It never trusts a name, email, employee number, or identity claim typed in chat for authorization. Private answers are limited to the signed-in employee’s own allowed records.',
    tl: 'Ginagamit ng Ask AI ang signed-in Supabase session bilang identity source. Hindi nito pinagkakatiwalaan ang pangalan, email, employee number, o identity claim na tinype sa chat para sa authorization. Private answers ay limitado sa sariling allowed records ng signed-in employee.',
  },
  notifications_announcements: {
    en: 'The portal may show announcements, holiday notices, birthdays, attention cards, and status messages on the dashboard depending on the current configuration and available records.',
    tl: 'Maaaring magpakita ang portal ng announcements, holiday notices, birthdays, attention cards, at status messages sa dashboard depende sa current configuration at available records.',
  },
  theme_display: {
    en: 'The portal supports light and dark mode. Some seasonal or company display settings can be controlled by administrators. If text looks unreadable after switching themes, report the exact screen so it can be fixed.',
    tl: 'May light at dark mode ang portal. Ang ilang seasonal o company display settings ay controlled ng administrators. Kung may text na hindi readable pagkatapos mag-switch ng theme, i-report ang exact screen para maayos.',
  },
  hr_workflows_overview: {
    en: 'HR tools generally cover employee attendance review, dispute handling, leave request review, leave credits, payslip publishing, employee directory views, team leave calendar, and HR support workflows. Ask AI can explain this at a high level but cannot expose HR-only private records to employees.',
    tl: 'Ang HR tools ay karaniwang para sa attendance review, dispute handling, leave request review, leave credits, payslip publishing, employee directory views, team leave calendar, at HR support workflows. Kayang i-explain ito ng Ask AI at a high level pero hindi puwedeng ilabas ang HR-only private records sa employees.',
  },
  admin_workflows_overview: {
    en: 'Super-admin tools generally cover account creation, account status, password reset support, attendance correction, app settings, audit logs, system health, database backup, and archival workflows. Ask AI can describe these generally but cannot perform admin actions or reveal admin-only data.',
    tl: 'Ang super-admin tools ay karaniwang para sa account creation, account status, password reset support, attendance correction, app settings, audit logs, system health, database backup, at archival workflows. Kayang i-describe ito ng Ask AI generally pero hindi ito gagawa ng admin actions o maglalabas ng admin-only data.',
  },
  general_navigation: {
    en: 'Use the sidebar, bottom navigation, dashboard cards, or All Tools sheet to move around the portal. Common employee areas include Dashboard, Attendance, Leave, My Payslips, Profile, Plan My Commute, My Disputes, announcements, holidays, and support-related tools when enabled.',
    tl: 'Gamitin ang sidebar, bottom navigation, dashboard cards, o All Tools sheet para lumipat sa portal. Common employee areas ang Dashboard, Attendance, Leave, My Payslips, Profile, Plan My Commute, My Disputes, announcements, holidays, at support-related tools kapag enabled.',
  },
};

