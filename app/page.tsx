'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Surface the exact Supabase error in the UI's red error box.
        // (Not using console.error here on purpose — Next.js dev mode
        // pops up its error overlay for any console.error call, even
        // ones we've already caught and handled gracefully like this.)
        throw new Error(authError.message);
      }

      if (!authData?.user) {
        throw new Error('Walang natanggap na user data mula sa server.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error(
          'Naka-login ka, pero hindi mahanap ang profile mo: ' + profileError.message
        );
      }

      // Redirect based on role. 'admin' covers both HR Admin accounts
      // created via the Super Admin form. 'super_admin' is a separate,
      // higher-privilege role you'd assign manually in Supabase (it's
      // not one of the two options in the "Create Account" form).
      if (profile?.role === 'super_admin') {
        router.push('/super-admin');
      } else if (profile?.role === 'admin') {
        router.push('/hr');
      } else if (profile?.role === 'employee') {
        router.push('/employee');
      } else {
        throw new Error(`Hindi kilalang role: "${profile?.role}". Kontakin ang Super Admin.`);
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Maling email o password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">

      {/* BACKGROUND IMAGE */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/hamdan-logo.png"
          alt="Background"
          fill
          className="object-cover opacity-[0.05] blur-sm"
          priority
        />
      </div>

      {/* LARGE TITLE BOX */}
      <div className="relative z-10 bg-white/95 px-12 py-10 rounded-3xl shadow-2xl border border-gray-100 mb-8 text-center max-w-2xl w-full">
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 tracking-tighter leading-tight">
          HAMDAN ENGINEERING CONSULTANCY
        </h1>
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="h-px w-16 bg-blue-600"></div>
          <p className="label-branded text-base font-extrabold tracking-[0.3em]">
            Representative Office
          </p>
          <div className="h-px w-16 bg-blue-600"></div>
        </div>
      </div>

      {/* LOGIN CARD */}
      <div className="relative z-10 w-full max-w-lg bg-white p-12 rounded-3xl shadow-2xl border border-gray-100">
        <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900">Employee Login</h2>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl border border-red-100 text-center mb-6 font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Username</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-blue-600/20 outline-none transition bg-gray-50 text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-blue-600/20 outline-none transition bg-gray-50 text-lg"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className="relative z-10 text-sm text-gray-400 mt-10 font-medium">
        © {new Date().getFullYear()} Hamdan Engineering Consultancy. All rights reserved.
      </p>
    </main>
  );
}
