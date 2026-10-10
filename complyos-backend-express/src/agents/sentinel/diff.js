export function diffText(previousText = '', currentText = '') {
  const previousParagraphs = (previousText || '')
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const currentParagraphs = (currentText || '')
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const changedParagraphs = currentParagraphs.filter((paragraph, index) => {
    const previous = previousParagraphs[index];
    return previous !== paragraph;
  });

  const removedParagraphs = previousParagraphs.filter((paragraph) => !currentParagraphs.includes(paragraph));

  return {
    changedParagraphs,
    removedParagraphs,
    hasChanged: changedParagraphs.length > 0 || removedParagraphs.length > 0,
  };
}

export default {
  diffText,
};
