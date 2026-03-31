// spotify.js — Spotify streaming service adapter
// Interface expected by index.html:
//   Spotify.isConfigured()
//   Spotify.startAuth(filters)          — redirects to OAuth
//   Spotify.getSavedFilters()           — restores filter state from sessionStorage after redirect
//   Spotify.createPlaylistFromSearch({ code, bands, playlistName, onProgress })
//                                       — exchanges code, fetches tracks, creates playlist
//   Spotify.MAX_ARTISTS                 — cap on bands to process
//   Spotify.TRACKS_PER_ARTIST          — tracks sampled per band

const Spotify = (() => {
  const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
  const REDIRECT_URI = 'https://chris-skud.github.io/colorado-bands/index.html';
  const TRACKS_PER_ARTIST = 2;
  const MAX_ARTISTS = 20;

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
    sessionStorage.setItem('streaming_service', 'spotify');
    sessionStorage.setItem('spotify_verifier', verifier);
    sessionStorage.setItem('spotify_filter_name', filters.name || '');
    sessionStorage.setItem('spotify_filter_genre', filters.genre || '');
    sessionStorage.setItem('spotify_filter_location', filters.location || '');
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'playlist-modify-public playlist-modify-private',
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location = 'https://accounts.spotify.com/authorize?' + params.toString();
  }

  function getSavedFilters() {
    const filters = {
      name: sessionStorage.getItem('spotify_filter_name') || '',
      genre: sessionStorage.getItem('spotify_filter_genre') || '',
      location: sessionStorage.getItem('spotify_filter_location') || '',
    };
    ['spotify_filter_name', 'spotify_filter_genre', 'spotify_filter_location',
     'spotify_verifier', 'streaming_service']
      .forEach(k => sessionStorage.removeItem(k));
    return filters;
  }

  async function exchangeCode(code) {
    const verifier = sessionStorage.getItem('spotify_verifier');
    const res = await fetch('https://accounts.spotify.com/api/token', {
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
    return (await res.json()).access_token;
  }

  async function fetchTopTracks(token, band) {
    const headers = { Authorization: `Bearer ${token}` };
    try {
      let artistId = band.spotify_id;
      if (!artistId) {
        const q = encodeURIComponent(`artist:${band.name}`);
        const res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`, { headers });
        artistId = (await res.json()).artists?.items?.[0]?.id;
      }
      if (!artistId) return [];
      const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, { headers });
      return ((await res.json()).tracks || []).slice(0, TRACKS_PER_ARTIST).map(t => t.uri);
    } catch {
      return [];
    }
  }

  // { code, bands, playlistName, onProgress }
  // Returns { url, skipped } on success; throws on failure.
  async function createPlaylistFromSearch({ code, bands, playlistName, onProgress }) {
    const token = await exchangeCode(code);
    const total = bands.length;
    const allUris = [];
    let skipped = 0;

    for (let i = 0; i < total; i += 5) {
      const batch = bands.slice(i, i + 5);
      const results = await Promise.all(batch.map(b => fetchTopTracks(token, b)));
      results.forEach(uris => {
        if (uris.length === 0) skipped++;
        allUris.push(...uris);
      });
      onProgress?.(`fetching tracks... (${Math.min(i + 5, total)}/${total})`);
    }

    if (allUris.length === 0) throw new Error('no tracks found');

    const me = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    const playlist = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playlistName, description: 'Colorado bands sampler', public: false }),
    }).then(r => r.json());

    for (let i = 0; i < allUris.length; i += 100) {
      await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: allUris.slice(i, i + 100) }),
      });
    }

    return { url: playlist.external_urls.spotify, skipped };
  }

  return {
    isConfigured: () => CLIENT_ID !== 'YOUR_CLIENT_ID_HERE',
    startAuth,
    getSavedFilters,
    createPlaylistFromSearch,
    MAX_ARTISTS,
    TRACKS_PER_ARTIST,
  };
})();
