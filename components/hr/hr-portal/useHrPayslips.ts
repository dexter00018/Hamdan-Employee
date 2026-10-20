'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/types/hr';
import { generateCutoffOptions, type Profile, type VerifyFn } from './shared';

// Payslip management for a single employee (the one open in the edit
// modal): upload PDFs per cutoff, publish (email trigger), delete.
export function useHrPayslips({ verify, setModalMode }: { verify: VerifyFn; setModalMode: (mode: 'payslips' | null) => void }) {
  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [payslipCutoff, setPayslipCutoff] = useState('');
  const [payslipUploading, setPayslipUploading] = useState(false);
  const [payslipMsg, setPayslipMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [employeePayslips, setEmployeePayslips] = useState<{ id: string; cutoff_label: string; file_name: string; file_path: string; uploaded_at: string; published: boolean; published_at: string | null; acknowledged_at: string | null }[]>([]);
  const [employeePayslipsLoading, setEmployeePayslipsLoading] = useState(false);
  const payslipFileRef = useRef<HTMLInputElement>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch payslips for the employee currently open in the edit modal.
  const fetchEmployeePayslips = async (userId: string) => {
    setEmployeePayslipsLoading(true);
    const { data, error } = await supabase
      .from('payslips')
      .select('id, cutoff_label, file_name, file_path, uploaded_at, published, published_at, acknowledged_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    if (error) console.error('Error fetching employee payslips:', error);
    setEmployeePayslips((data || []) as { id: string; cutoff_label: string; file_name: string; file_path: string; uploaded_at: string; published: boolean; published_at: string | null; acknowledged_at: string | null }[]);
    setEmployeePayslipsLoading(false);
  };

  // --- Publish payslip (triggers the payslip email send) ---
  // Marks the payslip published (visible/emailed) and asks the local API
  // route to fire the n8n webhook so the email goes out right away, instead
  // of waiting for the workflow's 10-minute polling fallback.
  const publishPayslip = async (payslipId: string, employeeId: string) => {
    setPublishingId(payslipId);
    setPublishMsg(null);
    try {
      const res = await fetch('/api/publish-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payslip_id: payslipId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to publish payslip.');

      setPublishMsg({
        type: 'success',
        text: result.emailTriggered
          ? 'Published! Email is being sent now.'
          : 'Published, but the instant email trigger failed -- it will still go out within 10 minutes via the automatic check.',
      });
      await fetchEmployeePayslips(employeeId);
    } catch (err: unknown) {
      console.error('Error publishing payslip:', err);
      setPublishMsg({ type: 'error', text: errorMessage(err, 'Failed to publish payslip.') });
    } finally {
      setPublishingId(null);
    }
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
    } catch (err: unknown) {
      console.error('Error uploading payslip:', err);
      setPayslipMsg({ type: 'error', text: errorMessage(err, 'Failed to upload payslip.') });
    } finally {
      setPayslipUploading(false);
    }
  };

  const deletePayslip = async (payslipId: string, filePath: string, employeeId: string) => {
    if (!await verify({ title: 'Delete this payslip?', description: 'This permanently removes the payslip file and record.', confirmLabel: 'Delete payslip', tone: 'danger', details: ['This action cannot be undone.'] })) return;
    try {
      await supabase.storage.from('payslips').remove([filePath]);
      const { error } = await supabase.from('payslips').delete().eq('id', payslipId);
      if (error) throw error;
      await fetchEmployeePayslips(employeeId);
    } catch (err: unknown) {
      console.error('Error deleting payslip:', err);
      alert('Failed to delete payslip: ' + errorMessage(err, 'Please try again.'));
    }
  };

  // Opens the Payslips modal for the selected profile
  const openPayslipsModal = (p: Profile) => {
    setPayslipFile(null);
    setPayslipCutoff('');
    setPayslipMsg(null);
    setPublishMsg(null);
    if (payslipFileRef.current) payslipFileRef.current.value = '';
    fetchEmployeePayslips(p.id);
    setModalMode('payslips');
  };

  return {
    payslipFile,
    setPayslipFile,
    payslipCutoff,
    setPayslipCutoff,
    payslipUploading,
    payslipMsg,
    setPayslipMsg,
    employeePayslips,
    employeePayslipsLoading,
    payslipFileRef,
    publishingId,
    publishMsg,
    publishPayslip,
    uploadPayslip,
    deletePayslip,
    openPayslipsModal,
  };
}
