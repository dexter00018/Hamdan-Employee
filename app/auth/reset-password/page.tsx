'use client';

// Mahalaga: Para hindi subukang i-prerender ng Next.js ang page na ito
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash?.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (!hash) {
      setErrorMsg('Missing reset token in URL.');
      return;
    }

    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const expires_in = params.get('expires_in');
    const type = params.get('type');

    if (!access_token || !refresh_token || !expires_in || !type) {
      setErrorMsg('Invalid reset token data.');
      return;
    }

    if (type !== 'recovery') {
      setErrorMsg('This token is not for password recovery.');
      return;
    }

    supabase.auth
      .setSession({
        access_token,
        refresh_token,
      })
      .then(({ error }) => {
        if (error) throw error;
        window.history.replaceState(null, '', window.location.pathname);
        setReady(true);
      })
      .catch((e: any) => {
        setErrorMsg(e?.message ?? 'Failed to initialize reset session.');
      });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      router.push('/auth/success-reset');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <section className="w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Reset Password</h1>

        {errorMsg && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {!ready ? (
          <div className="text-sm text-gray-600">Loading reset session…</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block text-sm font-semibold">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border rounded"
              placeholder="Enter new password"
            />
            <button
              type="submit"
              disabled={loading || newPassword.length < 6}
              className="w-full p-3 rounded bg-blue-600 text-white font-bold disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}