let refreshing: Promise<Response> | undefined;
export async function sessionFetch(url: string, init: RequestInit = {}) {
  let response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 401) {
    refreshing ??= fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).finally(() => { refreshing = undefined; });
    const restored = await refreshing;
    if (restored.ok) response = await fetch(url, { ...init, cache: 'no-store' });
    else if ([401,403].includes(restored.status)) window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  return response;
}
