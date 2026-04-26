const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}
