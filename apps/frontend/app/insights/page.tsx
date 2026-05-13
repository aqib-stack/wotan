'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import InsightsDashboard from '@/components/insights/InsightsDashboard';

export default function Page() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('wotan_token');
    const user = localStorage.getItem('wotan_user');

    if (!token || !user) {
      router.replace('/login');
      return;
    }

    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return null;
  }

  return <InsightsDashboard />;
}