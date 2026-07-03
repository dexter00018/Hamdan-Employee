// app/auth/success-reset/page.tsx
import Link from 'next/link';

export default function SuccessResetPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-white to-slate-50">
      <section className="w-full max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="mt-1 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-emerald-600"
              >
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Password Updated ✅
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                Your password has been successfully changed.
              </p>
            </div>
          </div>

          {/* Info card */}
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm text-slate-700">
              If you didn’t request this change, please contact support immediately
              and consider resetting your password again.
            </p>
          </div>

          {/* Actions - Isang button na lang */}
          <div className="mt-7">
            <Link
              href="/"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-slate-900 text-white px-8 py-3 text-sm font-semibold hover:bg-slate-800 transition"
            >
              Back to Home
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-6 text-xs text-slate-500">
            Thank you for keeping your account secure.
          </p>
        </div>
      </section>
    </main>
  );
}