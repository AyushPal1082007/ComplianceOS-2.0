import { fetchPages, withBlockCheck } from '../../../services/tinyfish.js';

export async function fetchSource(url, options = {}) {
  const [page] = await fetchPages([url], options);
  return withBlockCheck(page || {});
}

export default { fetchSource };
