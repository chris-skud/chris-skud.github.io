// apple-music.js — Apple Music streaming service adapter
// Interface:
//   AppleMusic.isConfigured()
//   AppleMusic.createPlaylistFromBands({ bands, playlistName, onProgress })
//   AppleMusic.MAX_ARTISTS
//   AppleMusic.TRACKS_PER_ARTIST
//
// Credentials: requires a MusicKit developer token (JWT) from developer.apple.com.
//   1. Sign in to developer.apple.com → Certificates, Identifiers & Profiles
//   2. Create a MusicKit identifier (Services → MusicKit)
//   3. Generate a private key and download it
//   4. Mint a JWT:
//        header:   { alg: "ES256", kid: YOUR_KEY_ID }
//        payload:  { iss: YOUR_TEAM_ID, iat: now, exp: now+15552000 (6 months),
//                    origin: ["https://chris-skud.github.io"] }
//      The origin field is important — Apple validates it server-side so the
//      token can only be used from this domain, not extracted and reused elsewhere.
//      Sign with ES256 using the downloaded .p8 private key.
//   5. Paste the resulting token below as DEVELOPER_TOKEN
//
// Auth: MusicKit.js handles user sign-in via popup — no page redirect needed.
// Note: artist IDs are extracted from music.apple.com links in band data,
//       falling back to catalog name search if no link is present.

const AppleMusic = (() => {
  const DEVELOPER_TOKEN = 'YOUR_APPLE_DEVELOPER_TOKEN_HERE';
  const TRACKS_PER_ARTIST = 2;
  const MAX_ARTISTS = 20;
  const API = 'https://api.music.apple.com/v1';
  const STOREFRONT = 'us';

  // Cached MusicKit instance, configured at first use.
  let _music = null;

  function isConfigured() {
    return DEVELOPER_TOKEN !== 'YOUR_APPLE_DEVELOPER_TOKEN_HERE';
  }

  async function getMusic() {
    if (_music && _music.isAuthorized) return _music;
    // MusicKit must already be loaded via <script> tag in HTML.
    await MusicKit.configure({
      developerToken: DEVELOPER_TOKEN,
      app: { name: 'Colorado Bands', build: '1.0.0' },
    });
    _music = MusicKit.getInstance();
    await _music.authorize();
    return _music;
  }

  function extractArtistId(band) {
    for (const link of (band.links || [])) {
      // https://music.apple.com/{locale}/artist/{id}
      const m = link.match(/music\.apple\.com\/[^/]+\/artist\/(\d+)/);
      if (m) return m[1];
      // https://itunes.apple.com/{locale}/artist/id{id}  or  .../artist/{name}/id{id}
      const i = link.match(/itunes\.apple\.com\/[^/]+\/artist\/(?:[^/]+\/)?id(\d+)/);
      if (i) return i[1];
    }
    return null;
  }

  async function fetchTopTracks(headers, band) {
    try {
      let artistId = extractArtistId(band);

      if (!artistId) {
        // Fall back to catalog name search
        const res = await fetch(
          `${API}/catalog/${STOREFRONT}/search?types=artists&term=${encodeURIComponent(band.name)}&limit=1`,
          { headers }
        );
        if (!res.ok) return [];
        const data = await res.json();
        artistId = data.results?.artists?.data?.[0]?.id;
      }

      if (!artistId) return [];

      const res = await fetch(
        `${API}/catalog/${STOREFRONT}/artists/${artistId}/view/top-songs?limit=${TRACKS_PER_ARTIST}`,
        { headers }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).slice(0, TRACKS_PER_ARTIST).map(t => t.id);
    } catch {
      return [];
    }
  }

  // { bands, playlistName, onProgress }
  // Returns { url, skipped } on success; throws on failure.
  async function createPlaylistFromBands({ bands, playlistName, onProgress }) {
    const music = await getMusic();
    const headers = {
      Authorization: `Bearer ${DEVELOPER_TOKEN}`,
      'Music-User-Token': music.musicUserToken,
    };

    const toProcess = bands.slice(0, MAX_ARTISTS);
    const total = toProcess.length;
    const trackIds = [];
    let skipped = 0;

    for (let i = 0; i < total; i += 5) {
      const batch = toProcess.slice(i, i + 5);
      const results = await Promise.all(batch.map(b => fetchTopTracks(headers, b)));
      results.forEach(ids => {
        if (ids.length === 0) skipped++;
        trackIds.push(...ids);
      });
      onProgress?.(`fetching tracks... (${Math.min(i + 5, total)}/${total})`);
    }

    if (trackIds.length === 0) throw new Error('no tracks found');

    const res = await fetch(`${API}/me/library/playlists`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attributes: {
          name: playlistName,
          description: 'Colorado bands sampler',
        },
        relationships: {
          tracks: {
            data: trackIds.map(id => ({ id, type: 'songs' })),
          },
        },
      }),
    });

    if (!res.ok) throw new Error(`playlist creation failed (${res.status})`);
    const data = await res.json();
    const playlistId = data.data?.[0]?.id;
    if (!playlistId) throw new Error('playlist creation failed');

    return {
      url: `https://music.apple.com/library/playlist/${playlistId}`,
      skipped,
    };
  }

  return {
    isConfigured,
    createPlaylistFromBands,
    MAX_ARTISTS,
    TRACKS_PER_ARTIST,
  };
})();
