// tidal.js — Tidal streaming service adapter
// Interface mirrors spotify.js:
//   Tidal.isConfigured()
//   Tidal.startAuth(filters)
//   Tidal.getSavedFilters()
//   Tidal.createPlaylistFromSearch({ code, bands, playlistName, onProgress })
//   Tidal.MAX_ARTISTS
//   Tidal.TRACKS_PER_ARTIST
//
// Credentials: apply at developer.tidal.com for a client ID.
// Auth: Authorization Code + PKCE (fully client-side, no server needed).
// Note: band data has no tidal_id field, so all artists are resolved by name search.

const Tidal = (() => {
  const CLIENT_ID = 'YOUR_TIDAL_CLIENT_ID_HERE';
  const REDIRECT_URI = 'https://chris-skud.github.io/colorado-bands/index.html';
  const TRACKS_PER_ARTIST = 2;
  const MAX_ARTISTS = 20;
  const API = 'https://api.tidal.com/v1';

  function generateRandomString(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map(x => chars[x % chars.length]).join('');
  }

  async function generateCodeChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async function startAuth(filters) {
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('streaming_service', 'tidal');
    sessionStorage.setItem('tidal_verifier', verifier);
    sessionStorage.setItem('tidal_filter_name', filters.name || '');
    sessionStorage.setItem('tidal_filter_genre', filters.genre || '');
    sessionStorage.setItem('tidal_filter_location', filters.location || '');
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'r_usr w_usr',
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location = 'https://listen.tidal.com/login/auth?' + params.toString();
  }

  function getSavedFilters() {
    const filters = {
      name: sessionStorage.getItem('tidal_filter_name') || '',
      genre: sessionStorage.getItem('tidal_filter_genre') || '',
      location: sessionStorage.getItem('tidal_filter_location') || '',
    };
    ['tidal_filter_name', 'tidal_filter_genre', 'tidal_filter_location',
     'tidal_verifier', 'streaming_service']
      .forEach(k => sessionStorage.removeItem(k));
    return filters;
  }

  async function exchangeCode(code) {
    const verifier = sessionStorage.getItem('tidal_verifier');
    const res = await fetch('https://login.tidal.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
    });
    if (!res.ok) throw new Error('token exchange failed');
    const data = await res.json();
    return {
      token: data.access_token,
      countryCode: data.user?.countryCode || 'US',
    };
  }

  async function fetchTopTracks(token, countryCode, band) {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      // Tidal has no tidal_id in band data — always resolve by name
      const searchRes = await fetch(
        `${API}/search?query=${encodeURIComponent(band.name)}&types=ARTISTS&limit=1&countryCode=${countryCode}`,
        { headers }
      );
      const artistId = (await searchRes.json()).artists?.items?.[0]?.id;
      if (!artistId) return [];

      const tracksRes = await fetch(
        `${API}/artists/${artistId}/toptracks?limit=${TRACKS_PER_ARTIST}&countryCode=${countryCode}`,
        { headers }
      );
      const items = (await tracksRes.json()).items || [];
      return items.slice(0, TRACKS_PER_ARTIST).map(t => t.id);
    } catch {
      return [];
    }
  }

  // { code, bands, playlistName, onProgress }
  // Returns { url, skipped } on success; throws on failure.
  async function createPlaylistFromSearch({ code, bands, playlistName, onProgress }) {
    const { token, countryCode } = await exchangeCode(code);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const total = bands.length;
    const allTrackIds = [];
    let skipped = 0;

    for (let i = 0; i < total; i += 5) {
      const batch = bands.slice(i, i + 5);
      const results = await Promise.all(batch.map(b => fetchTopTracks(token, countryCode, b)));
      results.forEach(ids => {
        if (ids.length === 0) skipped++;
        allTrackIds.push(...ids);
      });
      onProgress?.(`fetching tracks... (${Math.min(i + 5, total)}/${total})`);
    }

    if (allTrackIds.length === 0) throw new Error('no tracks found');

    const playlist = await fetch(`${API.replace('/v1', '/v2')}/playlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: playlistName, description: 'Colorado bands sampler' }),
    }).then(r => r.json());

    const uuid = playlist.data?.id || playlist.uuid || playlist.id;
    if (!uuid) throw new Error('playlist creation failed');

    // Tidal takes track IDs as a comma-separated string, max 100 per request
    for (let i = 0; i < allTrackIds.length; i += 100) {
      await fetch(`${API}/playlists/${uuid}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          trackIds: allTrackIds.slice(i, i + 100).join(','),
          onArtifactNotFound: 'SKIP',
          onDupes: 'ADD',
        }),
      });
    }

    return { url: `https://listen.tidal.com/playlist/${uuid}`, skipped };
  }

  return {
    isConfigured: () => CLIENT_ID !== 'YOUR_TIDAL_CLIENT_ID_HERE',
    startAuth,
    getSavedFilters,
    createPlaylistFromSearch,
    MAX_ARTISTS,
    TRACKS_PER_ARTIST,
  };
})();
