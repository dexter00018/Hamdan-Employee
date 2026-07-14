'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Spinner, { LoadingRow } from '@/components/Spinner';

type AttendanceLog = {
  id: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
  profiles?: { full_name: string | null };
};

type Profile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
};

// Must match app/employee/page.tsx and app/api/time-in/route.ts.
const LATE_CUTOFF_HOUR = 9;
const LATE_CUTOFF_MINUTE = 15;

export default function HRDashboard() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States — defaults to "today" (Philippine time) so HR sees
  // today's attendance by default instead of the entire history.
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  );
  // Cutoff period filter (1-15 / 16-31) -- when set, this takes over
  // from selectedDate for payroll-period review instead of a single day.
  const [cutoffFilter, setCutoffFilter] = useState('');

  // Which modal is open: null | 'choice' | 'edit' | 'payslips'
  const [modalMode, setModalMode] = useState<null | 'choice' | 'edit' | 'payslips'>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState({ id: null as string | null, full_name: '', employee_id: '', designation: '', sss_number: '', philhealth_number: '', pagibig_number: '', tin_number: '', hired_date: '', employment_status: '' });
  const [saveLoading, setSaveLoading] = useState(false);

  // Announcement States
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payslip upload states
  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [payslipCutoff, setPayslipCutoff] = useState('');
  const [payslipUploading, setPayslipUploading] = useState(false);
  const [payslipMsg, setPayslipMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [employeePayslips, setEmployeePayslips] = useState<{ id: string; cutoff_label: string; file_name: string; uploaded_at: string }[]>([]);
  const [employeePayslipsLoading, setEmployeePayslipsLoading] = useState(false);
  const payslipFileRef = useRef<HTMLInputElement>(null);

  // Attendance Disputes
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [disputeActionLoadingId, setDisputeActionLoadingId] = useState<string | null>(null);
  const [disputeMsg, setDisputeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Leave Requests
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(true);
  const [leaveActionLoadingId, setLeaveActionLoadingId] = useState<string | null>(null);
  const [leaveMsg, setLeaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leaveHrNotes, setLeaveHrNotes] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    refreshAllData();
    fetchAnnouncement();
    fetchDisputes();
    fetchLeaveRequests();
  }, []);

  const refreshAllData = async () => {
    setLoadingData(true);
    setErrorMsg(null);

    const [att, prof] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('*, profiles!inner(full_name)')
        .eq('profiles.role', 'employee')
        .order('time_in', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, employee_id, designation')
        .eq('role', 'employee')
        .order('full_name'),
    ]);

    if (att.error) {
      console.error('Error fetching attendance:', att.error);
      setErrorMsg(att.error.message);
    }
    if (prof.error) {
      console.error('Error fetching profiles:', prof.error);
      setErrorMsg((prev) => prev ?? prof.error.message);
    }

    setAttendance(att.data || []);
    setProfiles(prof.data || []);
    setLoadingData(false);
  };

  // Loads the current published announcement (if any) so HR can see and
  // edit what's already live before publishing changes.
  const fetchAnnouncement = async () => {
    setAnnouncementLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('id, content, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching announcement:', error);
      setAnnouncementMsg({ type: 'error', text: error.message });
      setAnnouncementLoading(false);
      return;
    }

    setAnnouncementId(data?.id ?? null);
    setAnnouncementContent(data?.content ?? '');
    setAnnouncementUpdatedAt(data?.updated_at ?? null);
    setAnnouncementLoading(false);
  };

  // Publishes the announcement. If one already exists we UPDATE it (so
  // there's always a single "current" announcement employees see);
  // otherwise we INSERT the first one. RLS only allows admin/super_admin
  // roles to write to this table.
  const publishAnnouncement = async () => {
    setAnnouncementSaving(true);
    setAnnouncementMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (announcementId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            content: announcementContent,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
          })
          .eq('id', announcementId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('announcements')
          .insert([{ content: announcementContent, updated_by: user?.id ?? null }])
          .select('id, updated_at')
          .single();

        if (error) throw error;
        setAnnouncementId(data.id);
      }

      setAnnouncementMsg({ type: 'success', text: 'Announcement published successfully.' });
      await fetchAnnouncement();
    } catch (err: any) {
      console.error('Error publishing announcement:', err);
      setAnnouncementMsg({ type: 'error', text: err?.message ?? 'Failed to publish announcement.' });
    } finally {
      setAnnouncementSaving(false);
    }
  };

  // --- Attendance Disputes ---
  const fetchDisputes = async () => {
    setDisputesLoading(true);
    const { data, error } = await supabase
      .from('attendance_disputes')
      .select(`
        id, attendance_log_id, dispute_date, claimed_time_in, original_time_in, reason, status, created_at, reviewed_at,
        employee:profiles!attendance_disputes_user_id_fkey(full_name),
        reviewer:profiles!attendance_disputes_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching disputes:', error);
      setDisputesLoading(false);
      return;
    }
    setDisputes(data || []);
    setDisputesLoading(false);
  };

  // Computes Present/Late the same way as everywhere else in the app,
  // based on the claimed time-in in Philippine time.
  const computeStatusForTime = (isoString: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(isoString)).reduce((acc: any, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    const hour = parseInt(parts.hour, 10);
    const minute = parseInt(parts.minute, 10);
    const isLate = hour > LATE_CUTOFF_HOUR || (hour === LATE_CUTOFF_HOUR && minute > LATE_CUTOFF_MINUTE);
    return isLate ? 'Late' : 'Present';
  };

  const approveDispute = async (dispute: any) => {
    setDisputeActionLoadingId(dispute.id);
    setDisputeMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const newStatus = computeStatusForTime(dispute.claimed_time_in);

      if (dispute.attendance_log_id) {
        // Existing (wrongly-tagged) log -- correct its time_in/status.
        const { error } = await supabase
          .from('attendance_logs')
          .update({ time_in: dispute.claimed_time_in, status: newStatus })
          .eq('id', dispute.attendance_log_id);
        if (error) throw error;
      } else {
        // No log existed for that day (forgot to time in) -- create it.
        const { data: disputeRow } = await supabase
          .from('attendance_disputes')
          .select('user_id')
          .eq('id', dispute.id)
          .single();

        const { error } = await supabase.from('attendance_logs').insert([{
          user_id: disputeRow?.user_id,
          log_date: dispute.dispute_date,
          time_in: dispute.claimed_time_in,
          status: newStatus,
        }]);
        if (error) throw error;
      }

      const { error: updateError } = await supabase
        .from('attendance_disputes')
        .update({ status: 'Approved', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null })
        .eq('id', dispute.id);
      if (updateError) throw updateError;

      setDisputeMsg({ type: 'success', text: 'Dispute approved and attendance record updated.' });
      await Promise.all([fetchDisputes(), refreshAllData()]);
    } catch (err: any) {
      console.error('Error approving dispute:', err);
      setDisputeMsg({ type: 'error', text: err?.message ?? 'Failed to approve dispute.' });
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  const rejectDispute = async (dispute: any) => {
    setDisputeActionLoadingId(dispute.id);
    setDisputeMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('attendance_disputes')
        .update({ status: 'Rejected', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null })
        .eq('id', dispute.id);
      if (error) throw error;

      setDisputeMsg({ type: 'success', text: 'Dispute rejected.' });
      await fetchDisputes();
    } catch (err: any) {
      console.error('Error rejecting dispute:', err);
      setDisputeMsg({ type: 'error', text: err?.message ?? 'Failed to reject dispute.' });
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  // --- Leave Requests ---
  const fetchLeaveRequests = async () => {
    setLeaveRequestsLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`id, leave_type, start_date, end_date, reason, status, hr_notes, created_at, reviewed_at,
        employee:profiles!leave_requests_user_id_fkey(full_name, id)`)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching leave requests:', error); }
    setLeaveRequests(data || []);
    setLeaveRequestsLoading(false);
  };

  const countLeaveDays = (start: string, end: string) => {
    let count = 0;
    const d = new Date(start);
    const endDate = new Date(end);
    while (d <= endDate) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const approveLeave = async (leave: any) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const days = countLeaveDays(leave.start_date, leave.end_date);
      const notes = leaveHrNotes[leave.id]?.trim() || null;

      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'Approved', hr_notes: notes, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', leave.id);
      if (error) throw error;

      // Deduct credits if employee is Regular
      const employeeId = leave.employee?.id;
      if (employeeId) {
        const { data: govId } = await supabase
          .from('employee_government_ids')
          .select('employment_status')
          .eq('user_id', employeeId)
          .maybeSingle();

        if (govId?.employment_status === 'Regular') {
          const year = new Date(leave.start_date).getFullYear();
          const { data: credits } = await supabase
            .from('leave_credits')
            .select('id, used_credits, total_credits')
            .eq('user_id', employeeId)
            .eq('year', year)
            .maybeSingle();

          if (credits) {
            await supabase
              .from('leave_credits')
              .update({ used_credits: Math.min(credits.used_credits + days, credits.total_credits) })
              .eq('id', credits.id);
          } else {
            // First leave of the year — create the credits row
            await supabase.from('leave_credits').insert([{
              user_id: employeeId,
              year,
              total_credits: 15,
              used_credits: Math.min(days, 15),
            }]);
          }
        }
      }

      setLeaveMsg({ type: 'success', text: 'Leave request approved.' });
      await fetchLeaveRequests();
    } catch (err: any) {
      console.error('Error approving leave:', err);
      setLeaveMsg({ type: 'error', text: err?.message ?? 'Failed to approve leave.' });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  const rejectLeave = async (leave: any) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const notes = leaveHrNotes[leave.id]?.trim() || null;
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'Rejected', hr_notes: notes, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', leave.id);
      if (error) throw error;
      setLeaveMsg({ type: 'success', text: 'Leave request rejected.' });
      await fetchLeaveRequests();
    } catch (err: any) {
      console.error('Error rejecting leave:', err);
      setLeaveMsg({ type: 'error', text: err?.message ?? 'Failed to reject leave.' });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  // Converts a UTC ISO timestamp to its Philippine calendar date
  // ("YYYY-MM-DD"). Comparing this instead of the raw UTC prefix avoids
  // misfiling records near midnight (PH is UTC+8, so a log_time_in of
  // "2026-07-05T17:30:00Z" is already July 6 in Manila).
  const toManilaDateString = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

  // Cutoff key format: "YYYY-MM:H1" (days 1-15) or "YYYY-MM:H2" (days
  // 16 to end of month) -- the standard PH semi-monthly payroll split.
  const matchesCutoff = (manilaDate: string, cutoffKey: string) => {
    const [ym, half] = cutoffKey.split(':');
    if (!manilaDate.startsWith(ym)) return false;
    const day = parseInt(manilaDate.split('-')[2], 10);
    return half === 'H1' ? day <= 15 : day >= 16;
  };

  // Filter Logic -- a chosen cutoff period takes priority over the
  // single-date filter, so HR can switch to payroll-period review
  // without the two filters fighting each other.
  const filteredAttendance = useMemo(() => {
    return attendance.filter((log) => {
      const matchesSearch = log.profiles?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (cutoffFilter) {
        matchesFilter = !!log.time_in && matchesCutoff(toManilaDateString(log.time_in), cutoffFilter);
      } else if (selectedDate) {
        matchesFilter = !!log.time_in && toManilaDateString(log.time_in) === selectedDate;
      }

      return matchesSearch && matchesFilter;
    });
  }, [attendance, searchTerm, selectedDate, cutoffFilter]);

  // Cutoff options generated from whatever months actually appear in
  // the attendance data, newest first.
  const availableCutoffs = useMemo(() => {
    const months = new Set<string>();
    attendance.forEach((log) => {
      if (log.time_in) months.add(toManilaDateString(log.time_in).slice(0, 7));
    });
    const opts: string[] = [];
    months.forEach((ym) => {
      opts.push(`${ym}:H1`);
      opts.push(`${ym}:H2`);
    });
    return opts.sort().reverse();
  }, [attendance]);

  const formatCutoffLabel = (key: string) => {
    const [ym, half] = key.split(':');
    const [y, m] = ym.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    return half === 'H1' ? `${monthName} 1-15, ${y}` : `${monthName} 16-31, ${y}`;
  };

  // Opens the choice modal — HR picks Edit Profile or Payslips
  const openProfileChoice = (p: Profile) => {
    setSelectedProfile(p);
    setModalMode('choice');
  };

  // Opens the Edit Profile modal for the selected profile
  const openEdit = async (p: Profile) => {
    setEditing({
      id: p.id,
      full_name: p.full_name || '',
      employee_id: p.employee_id || '',
      designation: p.designation || '',
      sss_number: '',
      philhealth_number: '',
      pagibig_number: '',
      tin_number: '',
      hired_date: '',
      employment_status: '',
    });
    setModalMode('edit');

    const { data: govIdData } = await supabase
      .from('employee_government_ids')
      .select('sss_number, philhealth_number, pagibig_number, tin_number, hired_date, employment_status')
      .eq('user_id', p.id)
      .maybeSingle();

    if (govIdData) {
      setEditing((prev) => ({
        ...prev,
        sss_number: govIdData.sss_number ?? '',
        philhealth_number: govIdData.philhealth_number ?? '',
        pagibig_number: govIdData.pagibig_number ?? '',
        tin_number: govIdData.tin_number ?? '',
        hired_date: govIdData.hired_date ?? '',
        employment_status: govIdData.employment_status ?? '',
      }));
    }
  };

  // Opens the Payslips modal for the selected profile
  const openPayslipsModal = (p: Profile) => {
    setPayslipFile(null);
    setPayslipCutoff('');
    setPayslipMsg(null);
    if (payslipFileRef.current) payslipFileRef.current.value = '';
    fetchEmployeePayslips(p.id);
    setModalMode('payslips');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProfile(null);
  };

  // Translates raw Postgres error text into a friendly, specific
  // message, instead of showing the raw "duplicate key value violates
  // unique constraint ..." text.
  const getFriendlyErrorMessage = (rawMessage: string): string => {
    const msg = rawMessage.toLowerCase();
    if (msg.includes('profiles_employee_id_key') || (msg.includes('employee_id') && msg.includes('duplicate'))) {
      return 'This Employee ID is already used by another account. Please use a different one.';
    }
    if (msg.includes('duplicate key value violates unique constraint')) {
      return 'Another account is already using the same information. Please check and try again.';
    }
    return rawMessage;
  };

  // Real-time warning: flags if the Employee ID being typed in the edit
  // modal already belongs to a DIFFERENT employee, so HR sees it before
  // saving instead of only after a failed update.
  const editingEmployeeIdConflict = useMemo(() => {
    const trimmed = editing.employee_id.trim().toLowerCase();
    if (!trimmed) return null;
    const match = profiles.find(
      (p) =>
        p.employee_id?.trim().toLowerCase() === trimmed && p.id !== editing.id
    );
    return match ? match.full_name : null;
  }, [editing.employee_id, editing.id, profiles]);

  const saveEdit = async () => {
    if (!editing.id) return;
    setSaveLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editing.full_name,
        employee_id: editing.employee_id,
        designation: editing.designation,
      })
      .eq('id', editing.id);

    if (error) {
      console.error('Error saving profile:', error);
      setErrorMsg(getFriendlyErrorMessage(error.message));
      setSaveLoading(false);
      return;
    }

    // Upsert government IDs into their own table -- only if HR actually
    // filled in at least one of the fields.
    if (
      editing.sss_number.trim() ||
      editing.philhealth_number.trim() ||
      editing.pagibig_number.trim() ||
      editing.tin_number.trim() ||
      editing.hired_date.trim() ||
      editing.employment_status.trim()
    ) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error: govIdError } = await supabase
        .from('employee_government_ids')
        .upsert({
          user_id: editing.id,
          sss_number: editing.sss_number.trim() || null,
          philhealth_number: editing.philhealth_number.trim() || null,
          pagibig_number: editing.pagibig_number.trim() || null,
          tin_number: editing.tin_number.trim() || null,
          hired_date: editing.hired_date.trim() || null,
          employment_status: editing.employment_status.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.id ?? null,
        }, { onConflict: 'user_id' });

      if (govIdError) {
        console.error('Error saving government IDs:', govIdError);
        setErrorMsg(getFriendlyErrorMessage(govIdError.message));
        setSaveLoading(false);
        return;
      }
    }

    await refreshAllData();
    setModalMode(null);
    setSaveLoading(false);
  };

  const statusTagClass = (s: string | null) => {
    if (s === 'Late') return 'tag-late';
    if (s === 'Excused') return 'tag-excused';
    return 'tag-present';
  };

  // Fetch payslips for the employee currently open in the edit modal.
  const fetchEmployeePayslips = async (userId: string) => {
    setEmployeePayslipsLoading(true);
    const { data, error } = await supabase
      .from('payslips')
      .select('id, cutoff_label, file_name, file_path, uploaded_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    if (error) console.error('Error fetching employee payslips:', error);
    setEmployeePayslips((data || []) as { id: string; cutoff_label: string; file_name: string; file_path: string; uploaded_at: string }[]);
    setEmployeePayslipsLoading(false);
  };

  // Generate cutoff options: current month ± 3 months, both halves.
  const generateCutoffOptions = () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthName = d.toLocaleDateString('en-US', { month: 'long' });
      options.push({ value: `${y}-${m}:H1`, label: `${monthName} 1-15, ${y}` });
      options.push({ value: `${y}-${m}:H2`, label: `${monthName} 16-31, ${y}` });
    }
    return options.reverse();
  };

  const uploadPayslip = async (employeeId: string) => {
    if (!payslipFile || !payslipCutoff) {
      setPayslipMsg({ type: 'error', text: 'Please select a file and a cutoff period.' });
      return;
    }
    if (payslipFile.type !== 'application/pdf') {
      setPayslipMsg({ type: 'error', text: 'Only PDF files are allowed.' });
      return;
    }
    setPayslipUploading(true);
    setPayslipMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const cutoffOption = generateCutoffOptions().find(o => o.value === payslipCutoff);
      const cutoffLabel = cutoffOption?.label || payslipCutoff;
      const filePath = `${employeeId}/${payslipCutoff.replace(':', '_')}_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('payslips')
        .upload(filePath, payslipFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('payslips').insert([{
        user_id: employeeId,
        cutoff_period: payslipCutoff,
        cutoff_label: cutoffLabel,
        file_path: filePath,
        file_name: payslipFile.name,
        uploaded_by: currentUser?.id ?? null,
      }]);
      if (dbError) {
        await supabase.storage.from('payslips').remove([filePath]);
        throw dbError;
      }

      setPayslipMsg({ type: 'success', text: `Payslip uploaded for ${cutoffLabel}.` });
      setPayslipFile(null);
      setPayslipCutoff('');
      if (payslipFileRef.current) payslipFileRef.current.value = '';
      await fetchEmployeePayslips(employeeId);
    } catch (err: any) {
      console.error('Error uploading payslip:', err);
      setPayslipMsg({ type: 'error', text: err?.message ?? 'Failed to upload payslip.' });
    } finally {
      setPayslipUploading(false);
    }
  };

  const deletePayslip = async (payslipId: string, filePath: string, employeeId: string) => {
    if (!confirm('Delete this payslip? This cannot be undone.')) return;
    try {
      await supabase.storage.from('payslips').remove([filePath]);
      const { error } = await supabase.from('payslips').delete().eq('id', payslipId);
      if (error) throw error;
      await fetchEmployeePayslips(employeeId);
    } catch (err: any) {
      console.error('Error deleting payslip:', err);
      alert('Failed to delete payslip: ' + err.message);
    }
  };

  const todayManila = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    return fmt.format(new Date()); // "YYYY-MM-DD"
  }, []);

  const todaysLogs = useMemo(
    () => attendance.filter((log) => log.time_in && toManilaDateString(log.time_in) === todayManila),
    [attendance, todayManila]
  );
  const presentTodayCount = todaysLogs.length;
  const lateTodayCount = todaysLogs.filter((l) => l.status === 'Late').length;

  const initials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-5">
        {/* Header */}
        <header className="branding-box flex items-center justify-between gap-3 !p-3 sm:!p-4">
          <div>
            <h1 className="text-base sm:text-lg md:text-2xl leading-tight">HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">HR Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4">
              <div className="text-center"><p className="stat-number text-xl text-white leading-none">{profiles.length}</p><p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-0.5">Employees</p></div>
              <div className="w-px h-8 bg-white/20"/>
              <div className="text-center"><p className="stat-number text-xl text-green-600 leading-none">{presentTodayCount}</p><p className="label-branded mt-0.5 mb-0">Present</p></div>
              <div className="w-px h-8 bg-white/20"/>
              <div className="text-center"><p className="stat-number text-xl text-orange-600 leading-none">{lateTodayCount}</p><p className="label-branded mt-0.5 mb-0">Late</p></div>
            </div>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-slate-500 font-medium text-xs hover:text-red-600 transition whitespace-nowrap">Sign out</button>
          </div>
        </header>

        {errorMsg && <div className="p-3 rounded-xl text-xs font-bold bg-red-50 text-red-700">{errorMsg}</div>}

        {/* Mobile stats */}
        <div className="grid grid-cols-3 gap-2 lg:hidden">
          <div className="card-dark flex flex-col items-center justify-center !p-3 text-center"><p className="stat-number text-xl text-white">{profiles.length}</p><p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-0.5">Employees</p></div>
          <div className="card-style flex flex-col items-center justify-center !p-3 text-center"><p className="stat-number text-xl text-green-600">{presentTodayCount}</p><p className="label-branded mt-0.5">Present</p></div>
          <div className="card-style flex flex-col items-center justify-center !p-3 text-center"><p className="stat-number text-xl text-orange-600">{lateTodayCount}</p><p className="label-branded mt-0.5">Late</p></div>
        </div>

        {/* Announcements */}
        <section className="card-style !p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h3 className="mb-0 text-sm">Announcements</h3>
            {announcementUpdatedAt && (
              <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">
                Last: {new Date(announcementUpdatedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {announcementMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${announcementMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{announcementMsg.text}</div>}
          {announcementLoading ? <LoadingRow label="Loading..." /> : (
            <>
              <textarea className="input-field w-full min-h-[80px] resize-y text-sm" placeholder="Type the announcement that all employees will see..." value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} />
              <button onClick={publishAnnouncement} disabled={announcementSaving || !announcementContent.trim()} className="btn-primary mt-3 !py-2.5 !text-xs disabled:opacity-50">
                {announcementSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Publishing...</span> : announcementId ? 'Update Announcement' : 'Publish Announcement'}
              </button>
            </>
          )}
        </section>

        {/* Disputes + Leave — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5">

        {/* Attendance Disputes */}
        <section className="card-style !p-4">
          <h3 className="mb-3 text-sm">Attendance Disputes</h3>
          {disputeMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${disputeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{disputeMsg.text}</div>}
          {disputesLoading ? <LoadingRow label="Loading disputes..." /> : (
            <>
              <p className="label-branded mb-2">Pending</p>
              {disputes.filter((d) => d.status === 'Pending').length === 0
                ? <p className="text-slate-400 text-xs mb-4">No pending disputes.</p>
                : <div className="space-y-2 mb-4">
                    {disputes.filter((d) => d.status === 'Pending').map((d) => (
                      <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs">{d.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{d.attendance_log_id ? 'Late tag dispute' : 'Missed time-in'} · <span className="font-medium">{d.dispute_date}</span></p>
                            {d.original_time_in && <p className="text-slate-400 text-xs">Was: <span className="font-bold text-slate-600">{new Date(d.original_time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</span></p>}
                            <p className="text-slate-400 text-xs">Claimed: <span className="font-bold text-slate-600">{new Date(d.claimed_time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</span></p>
                            {d.reason && <p className="text-slate-400 text-[10px] italic mt-0.5">"{d.reason}"</p>}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => approveDispute(d)} disabled={disputeActionLoadingId === d.id} className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition disabled:opacity-50">{disputeActionLoadingId === d.id ? '...' : 'Approve'}</button>
                            <button onClick={() => rejectDispute(d)} disabled={disputeActionLoadingId === d.id} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <p className="label-branded mb-2">Resolved</p>
              {disputes.filter((d) => d.status !== 'Pending').length === 0
                ? <p className="text-slate-400 text-xs">No resolved disputes yet.</p>
                : <div className="space-y-1.5">
                    {disputes.filter((d) => d.status !== 'Pending').map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-xs">{d.employee?.full_name ?? 'Unknown'}</span>
                          <span className="text-slate-400 text-xs"> · {d.dispute_date}</span>
                        </div>
                        <span className={d.status === 'Approved' ? 'tag-present' : 'tag-late'}>{d.status}</span>
                      </div>
                    ))}
                  </div>
              }
            </>
          )}
        </section>

        {/* Leave Requests */}
        <section className="card-style !p-4">
          <h3 className="mb-3 text-sm">Leave Requests</h3>
          {leaveMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${leaveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{leaveMsg.text}</div>}
          {leaveRequestsLoading ? <LoadingRow label="Loading leave requests..." /> : (
            <>
              <p className="label-branded mb-2">Pending</p>
              {leaveRequests.filter((l) => l.status === 'Pending').length === 0
                ? <p className="text-slate-400 text-xs mb-4">No pending leave requests.</p>
                : <div className="space-y-2 mb-4">
                    {leaveRequests.filter((l) => l.status === 'Pending').map((l) => (
                      <div key={l.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs">{l.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs mt-0.5"><span className="font-semibold">{l.leave_type}</span> · {l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)}d</p>
                            {l.reason && <p className="text-slate-400 text-[10px] italic mt-0.5">"{l.reason}"</p>}
                            <input type="text" className="input-field !py-1.5 !text-xs !min-h-0 mt-1.5" placeholder="HR notes (optional)..." value={leaveHrNotes[l.id] ?? ''} onChange={(e) => setLeaveHrNotes((prev) => ({ ...prev, [l.id]: e.target.value }))} />
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => approveLeave(l)} disabled={leaveActionLoadingId === l.id} className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition disabled:opacity-50">{leaveActionLoadingId === l.id ? '...' : 'Approve'}</button>
                            <button onClick={() => rejectLeave(l)} disabled={leaveActionLoadingId === l.id} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <p className="label-branded mb-2">Resolved</p>
              {leaveRequests.filter((l) => l.status !== 'Pending').length === 0
                ? <p className="text-slate-400 text-xs">No resolved leave requests yet.</p>
                : <div className="space-y-1.5">
                    {leaveRequests.filter((l) => l.status !== 'Pending').map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-xs">{l.employee?.full_name ?? 'Unknown'}</span>
                          <span className="text-slate-400 text-xs"> · {l.leave_type} · {l.start_date === l.end_date ? l.start_date : `${l.start_date}→${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)}d</span>
                        </div>
                        <span className={l.status === 'Approved' ? 'tag-present' : 'tag-late'}>{l.status}</span>
                      </div>
                    ))}
                  </div>
              }
            </>
          )}
        </section>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {/* Employee Sidebar */}
          <section className="card-style !p-4 lg:col-span-1">
            <h3 className="mb-3 text-sm">Employees</h3>
            <div className="space-y-2">
              {loadingData && profiles.length === 0 && <LoadingRow label="Loading employees..." />}
              {!loadingData && profiles.length === 0 && <p className="text-slate-400 text-xs">No employees found.</p>}
              {profiles.map((p) => (
                <button key={p.id} onClick={() => openProfileChoice(p)} className="w-full flex items-center gap-2.5 text-left p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] flex items-center justify-center">{initials(p.full_name)}</div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-xs truncate">{p.full_name}</div>
                    <div className="text-blue-600 text-[10px] truncate">{p.designation || '---'}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Attendance History */}
          <section className="card-style lg:col-span-3 overflow-hidden !p-0">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
              <h3 className="text-sm">
                Attendance History
                {cutoffFilter ? <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">Showing {formatCutoffLabel(cutoffFilter)}</span>
                  : selectedDate && <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">{selectedDate === todayManila ? "Today's records" : `Records for ${selectedDate}`}</span>}
              </h3>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <input className="input-field !py-1.5 !text-xs !min-h-0 md:w-40" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <select className="input-field !py-1.5 !text-xs !min-h-0 w-auto" value={cutoffFilter} onChange={(e) => { setCutoffFilter(e.target.value); if (e.target.value) setSelectedDate(''); }}>
                  <option value="">By cutoff...</option>
                  {availableCutoffs.map((c) => <option key={c} value={c}>{formatCutoffLabel(c)}</option>)}
                </select>
                <input type="date" className="input-field !py-1.5 !text-xs !min-h-0 w-auto" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) setCutoffFilter(''); }} />
                {selectedDate !== todayManila && <button onClick={() => { setSelectedDate(todayManila); setCutoffFilter(''); }} className="text-blue-600 font-bold text-xs whitespace-nowrap">Today</button>}
                {(selectedDate || cutoffFilter) && <button onClick={() => { setSelectedDate(''); setCutoffFilter(''); }} className="text-slate-400 font-bold text-xs whitespace-nowrap">All</button>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3">Time Out</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingData && attendance.length === 0 && <tr><td colSpan={5} className="px-4 py-6"><LoadingRow label="Loading..." /></td></tr>}
                  {filteredAttendance.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 text-xs">{log.profiles?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{log.time_in ? new Date(log.time_in).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="px-4 py-3"><span className={statusTagClass(log.status)}>{log.status}</span></td>
                    </tr>
                  ))}
                  {!loadingData && filteredAttendance.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">No attendance records found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* ── CHOICE MODAL ── */}
      {modalMode === 'choice' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs card-style shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center">
              {initials(selectedProfile.full_name)}
            </div>
            <h3 className="mb-1">{selectedProfile.full_name}</h3>
            <p className="text-slate-400 text-xs mb-6">{selectedProfile.designation || '---'}</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => openEdit(selectedProfile)}
                className="w-full py-3 rounded-full bg-slate-900 text-white font-bold text-sm hover:bg-slate-700 transition"
              >
                ✏️ Edit Profile
              </button>
              <button
                type="button"
                onClick={() => openPayslipsModal(selectedProfile)}
                className="w-full py-3 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition"
              >
                📄 Payslips
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ── */}
      {modalMode === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="mb-0">Edit Profile</h3>
              <button
                type="button"
                onClick={() => { setModalMode('choice'); }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ← Back
              </button>
            </div>
            <input className="input-field mb-3" value={editing.full_name} onChange={e => setEditing({...editing, full_name: e.target.value})} placeholder="Full Name" />
            <div className="mb-3">
              <input className="input-field" value={editing.employee_id} onChange={e => setEditing({...editing, employee_id: e.target.value})} placeholder="Employee ID" />
              {editingEmployeeIdConflict && (
                <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                  ⚠️ This Employee ID is already used by {editingEmployeeIdConflict}.
                </p>
              )}
            </div>
            <input className="input-field mb-6" value={editing.designation} onChange={e => setEditing({...editing, designation: e.target.value})} placeholder="Designation" />

            <div className="mb-6 pt-3 border-t border-slate-100">
              <p className="label-branded mb-3">Government IDs &amp; Employment Details</p>
              <div className="space-y-3">
                <input className="input-field" value={editing.sss_number} onChange={(e) => setEditing({ ...editing, sss_number: e.target.value })} placeholder="SSS Number" />
                <input className="input-field" value={editing.philhealth_number} onChange={(e) => setEditing({ ...editing, philhealth_number: e.target.value })} placeholder="PhilHealth Number" />
                <input className="input-field" value={editing.pagibig_number} onChange={(e) => setEditing({ ...editing, pagibig_number: e.target.value })} placeholder="Pag-IBIG Number" />
                <input className="input-field" value={editing.tin_number} onChange={(e) => setEditing({ ...editing, tin_number: e.target.value })} placeholder="TIN Number" />
                <div>
                  <label className="label-branded">Hired Date</label>
                  <input type="date" className="input-field" value={editing.hired_date} onChange={(e) => setEditing({ ...editing, hired_date: e.target.value })} />
                </div>
                <div>
                  <label className="label-branded">Employment Status</label>
                  <select className="input-field" value={editing.employment_status} onChange={(e) => setEditing({ ...editing, employment_status: e.target.value })}>
                    <option value="">Not set</option>
                    <option value="Regular">Regular</option>
                    <option value="Probationary">Probationary</option>
                    <option value="Contractual">Contractual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm" onClick={closeModal}>Cancel</button>
              <button className="flex-1 btn-primary" onClick={saveEdit} disabled={saveLoading || !!editingEmployeeIdConflict}>
                {saveLoading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Saving...</span>
                ) : editingEmployeeIdConflict ? 'Fix Conflict First' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYSLIPS MODAL ── */}
      {modalMode === 'payslips' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="mb-0">Payslips</h3>
                <p className="text-slate-400 text-xs mt-1">{selectedProfile.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode('choice')}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ← Back
              </button>
            </div>

            {/* Existing payslips */}
            {employeePayslipsLoading ? (
              <p className="text-slate-400 text-xs mb-4">Loading payslips...</p>
            ) : employeePayslips.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl mb-4">
                <p className="text-slate-400 text-sm">No payslips uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {employeePayslips.map((ps) => (
                  <div key={ps.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ps.cutoff_label}</p>
                      <p className="text-slate-400 text-[10px] truncate">{ps.file_name}</p>
                      <p className="text-slate-300 text-[10px]">
                        {new Date(ps.uploaded_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePayslip(ps.id, (ps as any).file_path, selectedProfile.id)}
                      className="flex-shrink-0 text-rose-500 hover:text-rose-700 text-xs font-bold transition px-2"
                      title="Delete payslip"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new payslip */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="label-branded">Upload New Payslip</p>

              {payslipMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${payslipMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {payslipMsg.text}
                </div>
              )}

              <select className="input-field" value={payslipCutoff} onChange={(e) => setPayslipCutoff(e.target.value)}>
                <option value="">Select cutoff period...</option>
                {generateCutoffOptions().map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <input
                ref={payslipFileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setPayslipFile(e.target.files?.[0] ?? null)}
                className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />

              <button
                type="button"
                onClick={() => uploadPayslip(selectedProfile.id)}
                disabled={payslipUploading || !payslipFile || !payslipCutoff}
                className="w-full py-3 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {payslipUploading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Uploading...</span>
                ) : 'Upload PDF'}
              </button>

              <button type="button" onClick={closeModal} className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
