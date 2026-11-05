// Normaliza acentos y separadores sin alterar la biblioteca guardada.
const fold = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Errores frecuentes al escribir nombres: p4p4 -> papa, r0ach -> roach.
const leet = (value) =>
  value.replace(
    /[4031578]/g,
    (digit) =>
      ({
        4: 'a',
        0: 'o',
        3: 'e',
        1: 'i',
        5: 's',
        7: 't',
        8: 'b',
      })[digit],
  );

function distance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1)
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[left.length][right.length];
}

function wordRank(query, word) {
  if (query === word) return 0;
  if (word.startsWith(query)) return 0.2;
  if (word.includes(query)) return 0.5;
  const tolerance = query.length < 4 ? 0 : Math.max(1, Math.floor(query.length * 0.34));
  if (Math.abs(query.length - word.length) > tolerance) return Infinity;
  const edits = distance(query, word);
  return edits <= tolerance ? 1 + edits / Math.max(query.length, word.length) : Infinity;
}

function score(track, needle) {
  const title = fold(track.title);
  const artist = fold(track.artist);
  const text = `${title} ${artist}`.trim();
  if (text === needle) return 0;
  if (text.startsWith(needle)) return 0.1;
  if (text.includes(needle)) return 0.3;
  const words = text.split(' ').filter(Boolean);
  const tokens = leet(needle).split(' ');
  let total = 1;
  for (const token of tokens) {
    const best = Math.min(...words.map((word) => wordRank(token, leet(word))));
    if (!Number.isFinite(best)) return Infinity;
    total += best;
  }
  return total;
}

export function searchTracks(tracks, query, limit = 8) {
  const needle = fold(query);
  if (!needle) return tracks.slice(0, limit).map((track, index) => ({ track, index }));
  return tracks
    .map((track, index) => ({ track, index, rank: score(track, needle) }))
    .filter((entry) => Number.isFinite(entry.rank))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, limit);
}
