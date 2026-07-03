'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function EmployeeDashboard() {
  const [loading, setLoading] = useState(false);
  const [isAlreadyTimedIn, setIsAlreadyTimedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, 1000);

    initializeDashboard();
    return () => clearInterval(timer);
  }, []);

  const initializeDashboard = async () => {
    setInitLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInitLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, employee_id, designation, role, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      setMessage('Error: ' + profileError.message);
    }

    setProfile(profileData);

    const { data: historyData, error: historyError } = await supabase
      .from('attendance_logs')
      .select('log_date, time_in')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false });

    if (historyError) {
      console.error('Error fetching history:', historyError);
      setMessage('Error: ' + historyError.message);
    }

    setHistory(historyData || []);
    const hasTimedInToday = historyData?.some(log => log.log_date === today);
    setIsAlreadyTimedIn(!!hasTimedInToday);
    setInitLoading(false);
  };

  const handleTimeIn = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You are not logged in!");

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('attendance_logs').insert([{
        user_id: user.id,
        time_in: new Date().toISOString(),
        log_date: today,
        status: 'Present'
      }]);

      if (error) throw error;
      setMessage("Success! Attendance recorded.");
      setIsAlreadyTimedIn(true);
      await initializeDashboard();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="branding-box">
          <div>
            <h1>HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Employee Portal</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
            className="text-slate-600 font-medium text-sm hover:text-red-600 transition"
          >
            Log Out
          </button>
        </header>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-bold ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Sidebar */}
          <div className="md:col-span-1">
            <div className="card-style sticky top-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt="Profile" width={96} height={96} className="object-cover w-full h-full" />
                ) : (
                  <div className="text-slate-400 font-bold">Logo</div>
                )}
              </div>
              <h2 className="text-xl font-semibold text-slate-900">{initLoading ? 'Loading...' : (profile?.full_name || 'Unknown')}</h2>
              <p className="text-blue-600 font-medium text-sm mb-6">{profile?.designation || '---'}</p>

              <div className="text-left border-t border-slate-100 pt-6">
                <p className="label-branded">Employee ID</p>
                <p className="font-medium text-slate-700">{profile?.employee_id || '---'}</p>
              </div>
            </div>
          </div>

          {/* Main Dashboard Area */}
          <div className="md:col-span-2 space-y-8">
            <div className="card-style p-10 text-center">
              <h1 className="text-blue-600 text-5xl font-semibold tabular-nums tracking-tighter">{time || '--:--:--'}</h1>
              <p className="mt-2 text-slate-400 font-medium uppercase text-[10px] tracking-widest">{date}</p>
            </div>

            <button
              onClick={handleTimeIn}
              disabled={loading || isAlreadyTimedIn || initLoading}
              className={`w-full py-4 rounded-xl font-medium transition-all ${isAlreadyTimedIn ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {loading ? 'Processing...' : isAlreadyTimedIn ? 'Already Timed In' : 'Time In'}
            </button>

            <div className="card-style">
              <h3 className="mb-6">Attendance History</h3>
              <div className="space-y-3">
                {initLoading && (
                  <p className="text-slate-400 text-sm">Loading...</p>
                )}
                {!initLoading && history.length === 0 && (
                  <p className="text-slate-400 text-sm">No attendance records yet.</p>
                )}
                {history.map((log, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <div className="font-medium text-slate-900">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                      <div className="label-branded mb-0">{log.log_date}</div>
                    </div>
                    <div className="font-semibold text-slate-700">{new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
