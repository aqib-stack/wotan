const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiGet<T>(path: string): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('wotan_token')
      : null;

  const res = await fetch(`${API}${path}`, {
    cache: 'no-store',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }

  return res.json();
}

export async function apiPost<T>(
  path: string,
  body: any,
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('wotan_token')
      : null;

  const res = await fetch(`${API}${path}`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },

    body: JSON.stringify(body),
  });

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      data?.message || `API error ${res.status}: ${path}`,
    );
  }

  return data as T;
}

export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('wotan_token')
      : null;

  const res = await fetch(`${API}${path}`, {
    method: 'POST',

    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,

    body: formData,
  });

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      data?.message || `API error ${res.status}: ${path}`,
    );
  }

  return data as T;
}