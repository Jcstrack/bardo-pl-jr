const fold = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

function distance(left, right) {
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= right.length; j += 1)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    row = next;
  }
  return row[right.length];
}

function score(track, query) {
  const text = fold(`${track.title} ${track.artist}`);
  if (text.startsWith(query)) return 0;
  if (text.includes(query)) return 1;
  const words = text.split(' ');
  let total = 2;
  for (const token of query.split(' ')) {
    const tolerance = token.length < 4 ? 0 : token.length < 7 ? 1 : 2;
    const best = Math.min(...words.map((word) => {
      if (word.startsWith(token)) return 0;
      if (word.includes(token)) return 0.5;
      if (Math.abs(word.length - token.length) > tolerance) return Infinity;
      const edits = distance(token, word);
      return edits <= tolerance ? 1 + edits : Infinity;
    }));
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
