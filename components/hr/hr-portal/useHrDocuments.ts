'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/types/hr';
import { type VerifyFn } from './shared';

type HrDocumentRow = {
  id: string;
  title: string;
  category: string;
  file_name: string;
  file_path: string;
  is_active: boolean;
  published_at: string | null;
};

// Employee Documents publishing: upload to storage + register in the
// employee_documents table, toggle availability, or delete outright.
export function useHrDocuments({ verify }: { verify: VerifyFn }) {
  const [hrDocumentsModalOpen, setHrDocumentsModalOpen] = useState(false);
  const [hrDocuments, setHrDocuments] = useState<HrDocumentRow[]>([]);
  const [hrDocumentsLoading, setHrDocumentsLoading] = useState(false);
  const [hrDocumentSaving, setHrDocumentSaving] = useState(false);
  const [hrDocumentTitle, setHrDocumentTitle] = useState('');
  const [hrDocumentCategory, setHrDocumentCategory] = useState('Company Policy');
  const [hrDocumentFile, setHrDocumentFile] = useState<File | null>(null);
  const hrDocumentFileRef = useRef<HTMLInputElement>(null);

  const fetchHrDocuments = async () => {
    setHrDocumentsLoading(true);
    const { data, error } = await supabase.from('employee_documents').select('id, title, category, file_name, file_path, is_active, published_at').order('published_at', { ascending: false });
    if (error) console.error('Error fetching employee documents:', error);
    setHrDocuments((data || []) as HrDocumentRow[]);
    setHrDocumentsLoading(false);
  };

  const uploadHrDocument = async () => {
    if (!hrDocumentTitle.trim() || !hrDocumentFile) { alert('Enter a title and choose a file.'); return; }
    setHrDocumentSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not logged in.');
      const safeName = hrDocumentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(filePath, hrDocumentFile, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('employee_documents').insert({ title: hrDocumentTitle.trim(), category: hrDocumentCategory, file_name: hrDocumentFile.name, file_path: filePath, created_by: user.id, is_active: true });
      if (insertError) { await supabase.storage.from('employee-documents').remove([filePath]); throw insertError; }
      setHrDocumentTitle(''); setHrDocumentFile(null); if (hrDocumentFileRef.current) hrDocumentFileRef.current.value = '';
      await fetchHrDocuments();
    } catch (error: unknown) { alert('Failed to publish document: ' + errorMessage(error, 'Please try again.')); }
    finally { setHrDocumentSaving(false); }
  };

  const toggleHrDocument = async (document: HrDocumentRow) => {
    const { error } = await supabase.from('employee_documents').update({ is_active: !document.is_active }).eq('id', document.id);
    if (error) alert('Failed to update document: ' + error.message); else await fetchHrDocuments();
  };

  const deleteHrDocument = async (document: HrDocumentRow) => {
    if (!await verify({ title: 'Delete employee document?', description: 'This removes the published file and its database record.', confirmLabel: 'Delete document', tone: 'danger', details: [document.title, 'Employees will no longer be able to download this file.'] })) return;
    const { error: storageError } = await supabase.storage.from('employee-documents').remove([document.file_path]);
    if (storageError) { alert('Failed to delete file: ' + storageError.message); return; }
    const { error } = await supabase.from('employee_documents').delete().eq('id', document.id);
    if (error) alert('Failed to delete document record: ' + error.message); else await fetchHrDocuments();
  };

  return {
    hrDocumentsModalOpen,
    setHrDocumentsModalOpen,
    hrDocuments,
    hrDocumentsLoading,
    hrDocumentSaving,
    hrDocumentTitle,
    setHrDocumentTitle,
    hrDocumentCategory,
    setHrDocumentCategory,
    hrDocumentFile,
    setHrDocumentFile,
    hrDocumentFileRef,
    fetchHrDocuments,
    uploadHrDocument,
    toggleHrDocument,
    deleteHrDocument,
  };
}
