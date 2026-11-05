export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));

export function keyboardSeekTarget(key, current, duration, shift = false) {
  const step = shift ? 10 : 1;
  if (key === 'Home') return 0;
  if (key === 'End') return duration;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return clamp(current - step, 0, duration);
  if (key === 'ArrowRight' || key === 'ArrowUp') return clamp(current + step, 0, duration);
  if (key === 'PageDown') return clamp(current - 10, 0, duration);
  if (key === 'PageUp') return clamp(current + 10, 0, duration);
  return null;
}

export function time(value) {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.floor(value);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
