// Only time between actual playback and pause/buffering events counts.
export const startVideoWatch = (tracker, now) => {
  if (tracker.startedAt === null) tracker.startedAt = now;
};
export const stopVideoWatch = (tracker, now) => {
  if (tracker.startedAt !== null) tracker.watchedMs += Math.max(0, now - tracker.startedAt);
  tracker.startedAt = null;
};
