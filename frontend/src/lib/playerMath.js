export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));

export function time(value) {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.floor(value);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
