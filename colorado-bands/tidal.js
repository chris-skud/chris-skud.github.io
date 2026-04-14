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

      if (!artistId) return [];

      // Search by name — results are popularity-ranked. Include track→artist
      // relationships so we can verify each track actually belongs to this artist.
      const res = await fetch(
        `${API}/searchresults/${encodeURIComponent(band.name)}?countryCode=${countryCode}&include=tracks,tracks.artists`,
        { headers }
      );
      if (!res.ok) return [];
      const json = await res.json();

      // Build a map of track id → set of artist ids from the included resources
      const trackArtists = {};
      for (const item of (json.included || [])) {
        if (item.type === 'tracks') {
          trackArtists[item.id] = new Set(
            (item.relationships?.artists?.data || []).map(a => a.id)
          );
        }
      }

      // Take the first TRACKS_PER_ARTIST tracks that belong to this artist
      const ordered = json.data?.relationships?.tracks?.data || [];
      const result = [];
      for (const t of ordered) {
        if (trackArtists[t.id]?.has(artistId)) {
          result.push(t.id);
          if (result.length >= TRACKS_PER_ARTIST) break;
        }
      }
      return result;
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
