export function albumIdsOf(track) {
  if (!track) return [];
  return Array.isArray(track.albumIds) && track.albumIds.length
    ? track.albumIds
    : track.albumId
      ? [track.albumId]
      : [];
}

export function trackInAlbum(track, albumId) {
  return Boolean(albumId && albumIdsOf(track).includes(albumId));
}
