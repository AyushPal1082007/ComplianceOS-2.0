export { normalizeSourceText } from '../normalize.js';
export default { normalizeSourceText: (text) => (typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '') };
