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
  const CLIENT_ID = '3J1VouZvleR2RFrL';
  const REDIRECT_URI = 'https://chris-skud.github.io/colorado-bands';
  const TRACKS_PER_ARTIST = 2;
  const MAX_ARTISTS = 20;
  const API = 'https://openapi.tidal.com/v2';

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
      scope: 'playlists.write',
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location = 'https://login.tidal.com/authorize?' + params.toString();
  }

  function getSavedFilters() {
    const filters = {
      name: sessionStorage.getItem('tidal_filter_name') || '',
      genre: sessionStorage.getItem('tidal_filter_genre') || '',
      location: sessionStorage.getItem('tidal_filter_location') || '',
    };
    ['tidal_filter_name', 'tidal_filter_genre', 'tidal_filter_location',
     'streaming_service']
      .forEach(k => sessionStorage.removeItem(k));
    return filters;
  }

  async function exchangeCode(code) {
    const verifier = sessionStorage.getItem('tidal_verifier');
    sessionStorage.removeItem('tidal_verifier');
    const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
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
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.api+json',
    };
    try {
      // Extract Tidal artist ID from band links (e.g. https://tidal.com/browse/artist/6478090)
      let artistId = null;
      for (const link of (band.links || [])) {
        const m = link.match(/tidal\.com\/(?:browse\/)?artist\/(\d+)/);
        if (m) { artistId = m[1]; break; }
      }

      // Fall back to searching by name
      if (!artistId) {
        const res = await fetch(
          `${API}/searchresults/${encodeURIComponent(band.name)}?countryCode=${countryCode}&include=artists`,
          { headers }
        );
        if (!res.ok) return [];
        const json = await res.json();
        artistId = json.data?.relationships?.artists?.data?.[0]?.id;
        if (!artistId) return [];
      }

      // Get artist albums, then pull tracks from the first one
      const albumsRes = await fetch(
        `${API}/artists/${artistId}/relationships/albums?countryCode=${countryCode}`,
        { headers }
      );
      if (!albumsRes.ok) return [];
      const albumId = (await albumsRes.json()).data?.[0]?.id;
      if (!albumId) return [];

      const tracksRes = await fetch(
        `${API}/albums/${albumId}/relationships/items?countryCode=${countryCode}`,
        { headers }
      );
      if (!tracksRes.ok) return [];
      const tracksJson = await tracksRes.json();
      return (tracksJson.data || []).slice(0, TRACKS_PER_ARTIST).map(t => t.id);
    } catch {
      return [];
    }
  }

  // { code, bands, playlistName, onProgress }
  // Returns { url, skipped } on success; throws on failure.
  async function createPlaylistFromSearch({ code, bands, playlistName, onProgress }) {
    const { token, countryCode } = await exchangeCode(code);
    const jsonApiHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    };
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

    const playlistRes = await fetch(`${API}/playlists`, {
      method: 'POST',
      headers: jsonApiHeaders,
      body: JSON.stringify({
        data: {
          type: 'playlists',
          attributes: { name: playlistName, description: 'Colorado bands sampler' },
        },
      }),
    });
    if (!playlistRes.ok) throw new Error('playlist creation failed');
    const playlistJson = await playlistRes.json();
    const uuid = playlistJson.data?.id;
    if (!uuid) throw new Error('playlist creation failed');

    // Add tracks in batches (JSON:API relationship format)
    for (let i = 0; i < allTrackIds.length; i += 100) {
      await fetch(`${API}/playlists/${uuid}/relationships/items`, {
        method: 'POST',
        headers: jsonApiHeaders,
        body: JSON.stringify({
          data: allTrackIds.slice(i, i + 100).map(id => ({ id: String(id), type: 'tracks' })),
        }),
      });
    }

    return { url: `https://tidal.com/browse/playlist/${uuid}`, skipped };
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
