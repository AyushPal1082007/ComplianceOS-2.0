export { diffText } from '../diff.js';
export default { diffText: (oldText = '', newText = '') => ({ changedParagraphs: [newText], hasChanged: oldText !== newText }) };
