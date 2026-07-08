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
    const initSession = async () => {
      const url = new URL(window.location.href);

      // Supabase appends these if the link itself is invalid/expired --
      // check this first so we can show a clear, specific message
      // instead of a generic "invalid token" one.
      const urlError = url.searchParams.get('error') || url.searchParams.get('error_code');
      const urlErrorDescription = url.searchParams.get('error_description');
      if (urlError) {
        setErrorMsg(
          urlErrorDescription
            ? decodeURIComponent(urlErrorDescription.replace(/\+/g, ' '))
            : 'This reset link is invalid or has expired. Please request a new one.'
        );
        return;
      }

      // --- Path 1: PKCE flow -- newer Supabase projects send a `?code=`
      // query param instead of a hash fragment. ---
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMsg(error.message || 'Failed to initialize reset session.');
          return;
        }
        window.history.replaceState(null, '', window.location.pathname);
        setReady(true);
        return;
      }

      // --- Path 2: Implicit flow (older Supabase default) -- token
      // arrives as a URL hash fragment instead. ---
      const hash = window.location.hash?.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;

      if (!hash) {
        setErrorMsg('Missing reset token in URL. Please use the link from your email again, or request a new one.');
        return;
      }

      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const expires_in = params.get('expires_in');
      const type = params.get('type');

      if (!access_token || !refresh_token || !expires_in || !type) {
        setErrorMsg('Invalid reset token data. Please request a new password reset email.');
        return;
      }

      if (type !== 'recovery') {
        setErrorMsg('This token is not for password recovery.');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to initialize reset session.');
        return;
      }

      window.history.replaceState(null, '', window.location.pathname);
      setReady(true);
    };

    initSession();
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

        {!ready && !errorMsg ? (
          <div className="text-sm text-gray-600">Loading reset session…</div>
        ) : ready ? (
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
        ) : null}
      </section>
    </main>
  );
}
