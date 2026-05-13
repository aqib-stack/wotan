'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiPost } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const data = await apiPost<any>('/auth/login', {
        email,
        password,
      });

      localStorage.setItem('wotan_token', data.token);

      localStorage.setItem(
        'wotan_user',
        JSON.stringify(data.user),
      );

      router.push('/insights');
    } catch (error: any) {
      alert(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#1A1A1A] flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        <div className="mb-10">
          <p className="uppercase tracking-[0.3em] text-[11px] text-[#7E7A74] mb-4">
            WOTAN PROJECT · ACCESS PORTAL
          </p>

          <h1 className="text-[52px] leading-none font-semibold tracking-[-0.04em]">
            Login
          </h1>

          <p className="mt-4 text-[#6E6A65] text-[15px] leading-7">
            Access your investor behaviour dashboard and
            connected Stake analytics environment.
          </p>
        </div>

        <div className="border border-[#DEDAD2] rounded-[28px] bg-white/50 backdrop-blur p-8">
          <form onSubmit={handleLogin} className="space-y-5">

            <div>
              <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                Email Address
              </label>

              <input
                type="email"
                placeholder="you@example.com"
                className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none text-[15px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.24em] text-[#7E7A74] mb-2">
                Password
              </label>

              <input
                type="password"
                placeholder="••••••••"
                className="w-full h-[58px] px-5 rounded-2xl border border-[#DEDAD2] bg-[#F8F6F1] outline-none text-[15px]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[58px] rounded-2xl bg-[#1A1A1A] text-white font-medium text-[15px] mt-2"
            >
              {loading ? 'Accessing...' : 'Access Dashboard'}
            </button>

          </form>
        </div>

        <p className="mt-6 text-[14px] text-[#6E6A65]">
          Don’t have an account?{' '}
          <a
            href="/signup"
            className="underline underline-offset-4 text-[#1A1A1A]"
          >
            Create account
          </a>
        </p>

      </div>
    </div>
  );
}