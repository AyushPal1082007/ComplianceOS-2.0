const userLocks = new Map();

export async function withUserLock(userId, operation) {
  if (!userId) throw new TypeError('A lock key is required');
  const previous = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  userLocks.set(userId, queued);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (userLocks.get(userId) === queued) userLocks.delete(userId);
  }
}

export default { withUserLock };
