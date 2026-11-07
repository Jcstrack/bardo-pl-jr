export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));

export function seekTarget(value, duration, playStart = 0, movingStartMarker = false) {
  const maximum = duration || value;
  const minimum = movingStartMarker ? 0 : (playStart ?? 0);
  return clamp(value, Math.min(minimum, maximum), maximum);
}

export function keyboardSeekTarget(key, current, duration, shift = false, minimum = 0) {
  const step = shift ? 10 : 1;
  if (key === 'Home') return minimum;
  if (key === 'End') return duration;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return clamp(current - step, minimum, duration);
  if (key === 'ArrowRight' || key === 'ArrowUp') return clamp(current + step, minimum, duration);
  if (key === 'PageDown') return clamp(current - 10, minimum, duration);
  if (key === 'PageUp') return clamp(current + 10, minimum, duration);
  return null;
}

export function time(value) {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.floor(value);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
