import { useEffect, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const KEY = 'bardo.spotify.session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function tokenRequest(parameters) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
  });
  if (!response.ok) throw new Error('Spotify no pudo completar la conexión. Revisa el Client ID y la Redirect URI.');
  return response.json();
}

export default function useSpotifyAuth() {
  const [state, setState] = useState({ phase: CLIENT_ID ? 'checking' : 'unconfigured', error: '', user: '' });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    const run = async () => {
      try {
        const params = new URLSearchParams(location.search);
        let session = readSession();
        if (params.has('code')) {
          const verifier = sessionStorage.getItem('bardo.spotify.verifier');
          const expected = sessionStorage.getItem('bardo.spotify.state');
          if (!verifier || params.get('state') !== expected) throw new Error('La validación de Spotify caducó. Intenta iniciar sesión otra vez.');
          const token = await tokenRequest({ client_id: CLIENT_ID, grant_type: 'authorization_code', code: params.get('code'), redirect_uri: `${location.origin}/`, code_verifier: verifier });
          session = { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 };
          localStorage.setItem(KEY, JSON.stringify(session));
          sessionStorage.removeItem('bardo.spotify.verifier');
          sessionStorage.removeItem('bardo.spotify.state');
          history.replaceState(null, '', location.pathname);
        }
        if (params.has('error')) throw new Error('Spotify canceló la autorización.');
        if (!session) { if (!cancelled) setState({ phase: 'login', error: '', user: '' }); return; }
        if (Date.now() > session.expiresAt - 60_000) {
          if (!session.refreshToken) throw new Error('La sesión de Spotify caducó.');
          const token = await tokenRequest({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: session.refreshToken });
          session = { accessToken: token.access_token, refreshToken: token.refresh_token || session.refreshToken, expiresAt: Date.now() + token.expires_in * 1000 };
          localStorage.setItem(KEY, JSON.stringify(session));
        }
        const response = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${session.accessToken}` } });
        if (!response.ok) throw new Error('Spotify no reconoció la sesión.');
        const user = await response.json();
        if (!cancelled) setState({ phase: 'ready', error: '', user: user.display_name || user.id });
      } catch (error) {
        localStorage.removeItem(KEY);
        history.replaceState(null, '', location.pathname);
        if (!cancelled) setState({ phase: 'login', error: error.message, user: '' });
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const login = async () => {
    if (!CLIENT_ID) return;
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
    const challenge = base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const nonce = base64Url(crypto.getRandomValues(new Uint8Array(16)));
    sessionStorage.setItem('bardo.spotify.verifier', verifier);
    sessionStorage.setItem('bardo.spotify.state', nonce);
    const url = new URL('https://accounts.spotify.com/authorize');
    url.search = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: `${location.origin}/`, code_challenge_method: 'S256', code_challenge: challenge, state: nonce, scope: 'user-read-private' });
    location.assign(url.toString());
  };
  return { ...state, login };
}
