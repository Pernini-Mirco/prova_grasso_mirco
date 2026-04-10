
const apiBase = import.meta.env.VITE_API_BASE_URL || '';

export async function api(path, options = {}) {
  const { authToken, headers, ...rest } = options;
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(headers || {})
    },
    ...rest
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Errore server');
  }
  return data;
}
