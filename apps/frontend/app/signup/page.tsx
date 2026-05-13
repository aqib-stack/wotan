'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiPost } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    country: '',
    preferredCurrency: '',
    stakeUsername: '',
  });

  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const data = await apiPost<any>(
        '/auth/register',
        form,
      );

      localStorage.setItem('wotan_token', data.token);

      localStorage.setItem(
        'wotan_user',
        JSON.stringify(data.user),
      );

      router.push('/insights');
    } catch (error: any) {
      alert(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#1A1A1A] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-xl">

        <div className="mb-10">
          <p className="uppercase tracking-[0.3em] text-[11px] text-[#7E7A74] mb-4">
            WOTAN PROJECT · REGISTRATION
          </p>

          <h1 className="text-[52px] leading-none font-semibold tracking-[-0.04em]">
            Create Account
          </h1>

          <p className="mt-4 text-[#6E6A65] text-[15px] leading-7">
            Create your investor profile to access behavioural
            analytics, betting intelligence, and automation systems.
          </p>
        </div>

        <div className="border border-[#DEDAD2] rounded-[28px] bg-white/50 backdrop-blur p-8">

          <form onSubmit={handleSignup} className="space-y-5">

            <div>
              <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                Full Name
              </label>

              <input
                placeholder="John Carter"
                className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none"
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
              />
            </div>

            <div className="grid md:grid-cols-2 gap-5">

              <div>
                <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                  Email Address
                </label>

                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                  Password
                </label>

                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>

            </div>

            <div className="grid md:grid-cols-2 gap-5">

              <div>
                <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                  Country
                </label>

                <input
                  placeholder="Pakistan"
                  className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none"
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                  Preferred Currency
                </label>

                <input
                  placeholder="PKR"
                  className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none"
                  value={form.preferredCurrency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      preferredCurrency: e.target.value,
                    })
                  }
                />
              </div>

            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                Stake Username
              </label>

              <input
                placeholder="optional"
                className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none"
                value={form.stakeUsername}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stakeUsername: e.target.value,
                  })
                }
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[60px] rounded-2xl bg-[#1A1A1A] text-white font-medium text-[15px] mt-2"
            >
              {loading
                ? 'Creating Account...'
                : 'Create Investor Account'}
            </button>

          </form>
        </div>

        <p className="mt-6 text-[14px] text-[#6E6A65]">
          Already have an account?{' '}
          <a
            href="/login"
            className="underline underline-offset-4 text-[#1A1A1A]"
          >
            Login
          </a>
        </p>

      </div>
    </div>
  );
}