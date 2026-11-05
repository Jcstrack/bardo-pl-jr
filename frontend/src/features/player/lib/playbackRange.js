export function repeatStart(loopStart, playStart) {
  return loopStart ?? playStart ?? 0;
}

export function repeatEnd(loopEnd, playNext, playEnd, duration = null, start = 0) {
  return (
    [loopEnd, playNext, playEnd, duration].find(
      (point) => Number.isFinite(point) && point > start + 0.25,
    ) ?? null
  );
}
