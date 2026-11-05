const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function urlsFromDrop(dataTransfer) {
  const text = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.match(/https?:\/\/[^\s<>]+/i)?.[0])
        .filter(Boolean),
    ),
  ];
}

export function parseMediaUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Escribe una URL válida.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('El enlace debe comenzar con https:// o http://.');
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId = null;
  if (host === 'youtu.be') videoId = url.pathname.split('/')[1];
  if (
    ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)
  ) {
    videoId =
      url.searchParams.get('v') ||
      (/^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null);
  }
  if (videoId !== null) {
    if (!VIDEO_ID.test(videoId))
      throw new Error('No encontré un video válido en ese enlace de YouTube.');
    return {
      kind: 'youtube',
      src: url.href,
      videoId,
      artist: 'YouTube',
      fallbackTitle: 'Video de YouTube',
    };
  }
  if (host === 'open.spotify.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const typeIndex = parts[0]?.startsWith('intl-') ? 1 : 0;
    const type = parts[typeIndex] === 'embed' ? parts[typeIndex + 1] : parts[typeIndex];
    const id = parts[typeIndex] === 'embed' ? parts[typeIndex + 2] : parts[typeIndex + 1];
    if (!['track', 'episode'].includes(type) || !/^[A-Za-z0-9]{22}$/.test(id || '')) {
      throw new Error(
        'Pega el enlace de una canción o episodio de Spotify, no el de un álbum o playlist.',
      );
    }
    return {
      kind: 'spotify',
      src: `https://open.spotify.com/${type}/${id}`,
      artist: 'Spotify',
      fallbackTitle: type === 'track' ? 'Canción de Spotify' : 'Episodio de Spotify',
    };
  }
  if (host.includes('youtube.') || host.includes('spotify.')) {
    throw new Error('Usa un video de YouTube o un enlace directo a un archivo de audio.');
  }
  let filename = url.pathname.split('/').pop() || 'Audio en línea';
  try {
    filename = decodeURIComponent(filename);
  } catch {
    /* conservar el nombre original */
  }
  filename = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();
  return { kind: 'url', src: url.href, artist: host, fallbackTitle: filename || 'Audio en línea' };
}
