export function reviewQueue(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    status: item.status || 'PENDING_REVIEW',
  }));
}

export default {
  reviewQueue,
};
