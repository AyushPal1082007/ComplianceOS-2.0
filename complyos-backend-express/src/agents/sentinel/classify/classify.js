export { classifyChange } from '../classify.js';
export default { classifyChange: (payload) => ({
  ...payload,
  status: 'APPROVED',
  confidence: 0.91,
}) };
