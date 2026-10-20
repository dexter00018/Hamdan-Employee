'use client';

import { useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { type Profile } from './shared';

// Edit Profile domain: the editing buffer + avatar picker + conflict
// warning + save (profiles update + government-IDs upsert in one flow).
export function useHrEmployeeEditor({ profiles, setErrorMsg, setModalMode, refreshAllData }: {
  profiles: Profile[];
  setErrorMsg: (msg: string | null) => void;
  setModalMode: (mode: 'edit' | 'choice' | 'payslips' | null) => void;
  refreshAllData: () => Promise<void>;
}) {
  type Editing = {
    id: string | null;
    full_name: string;
    employee_id: string;
    designation: string;
    employee_email: string;
    sss_number: string;
    philhealth_number: string;
    pagibig_number: string;
    tin_number: string;
    hired_date: string;
    employment_status: string;
  };

  const [editing, setEditing] = useState<Editing>({
    id: null,
    full_name: '',
    employee_id: '',
    designation: '',
    employee_email: '',
    sss_number: '',
    philhealth_number: '',
    pagibig_number: '',
    tin_number: '',
    hired_date: '',
    employment_status: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const MAX_AVATAR_MB = 5;

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

  const handleAvatarChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setErrorMsg(`Image must be under ${MAX_AVATAR_MB}MB.`);
      return;
    }
    setErrorMsg(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Opens the Edit Profile modal for the selected profile
  const openEdit = async (p: Profile) => {
    setEditing({
      id: p.id,
      full_name: p.full_name || '',
      employee_id: p.employee_id || '',
      designation: p.designation || '',
      employee_email: p.employee_email || '',
      sss_number: '',
      philhealth_number: '',
      pagibig_number: '',
      tin_number: '',
      hired_date: '',
      employment_status: '',
    });

    // Reset avatar picker state and load the employee's current photo
    // (if any) as the starting preview.
    setAvatarFile(null);
    setAvatarPreview(null);
    setCurrentAvatarUrl(p.avatar_url ?? null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';

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

    // Upload the new avatar first (if HR picked one) so we have the
    // final public URL ready to include in the same profiles update
    // below -- avoids a second round-trip / partial-save state.
    let nextAvatarUrl: string | undefined = undefined;
    if (avatarFile) {
      setAvatarUploading(true);
      const ext = avatarFile.name.split('.').pop() || 'jpg';
      const filePath = `${editing.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { contentType: avatarFile.type, upsert: false });

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        setErrorMsg(getFriendlyErrorMessage(uploadError.message));
        setAvatarUploading(false);
        setSaveLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      nextAvatarUrl = publicUrlData.publicUrl;
      setAvatarUploading(false);
    }

    const updatePayload: Database['public']['Tables']['profiles']['Update'] = {
      full_name: editing.full_name,
      employee_id: editing.employee_id,
      designation: editing.designation,
      employee_email: editing.employee_email.trim() || null,
    };
    if (nextAvatarUrl !== undefined) updatePayload.avatar_url = nextAvatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
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

  return {
    editing,
    setEditing,
    saveLoading,
    avatarFile,
    setAvatarFile,
    avatarPreview,
    setAvatarPreview,
    currentAvatarUrl,
    avatarUploading,
    avatarInputRef,
    getFriendlyErrorMessage,
    handleAvatarChange,
    openEdit,
    editingEmployeeIdConflict,
    saveEdit,
  };
}
