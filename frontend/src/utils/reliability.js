const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms || 0)));
  });

export const verifyEventually = async ({
  checkFn,
  delaysMs = [2000, 4000, 6000]
} = {}) => {
  if (typeof checkFn !== 'function') return false;
  const delays = Array.isArray(delaysMs) && delaysMs.length ? delaysMs : [2000, 4000, 6000];
  for (const delayMs of delays) {
    await sleep(delayMs);
    try {
      const result = await checkFn();
      if (result) return true;
    } catch {
      // keep polling attempts
    }
  }
  return false;
};

export default verifyEventually;
