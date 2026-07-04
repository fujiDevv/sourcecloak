/**
 * Detect README-style markdown documentation so Tier 3 ONNX can skip
 * structural heuristics that false-positive on fenced code and file trees.
 */
export function isMarkdownDocumentation(text: string): boolean {
  const sample = text.slice(0, 3000);
  if (!sample.trim()) return false;

  let signals = 0;

  if (/^#{1,6}\s+\S/m.test(sample)) signals += 1;
  if ((sample.match(/^#{1,6}\s/gm) ?? []).length >= 3) signals += 2;
  if (/```[\s\S]*?```/.test(sample)) signals += 1;
  if (/\[.+?\]\(https?:\/\/[^\s)]+\)/.test(sample)) signals += 1;
  if (/img\.shields\.io|!\[.*?\]\(/i.test(sample)) signals += 1;
  if (/^\|.+\|$/m.test(sample)) signals += 2;
  if (/^[-*+]\s+(\*\*|\[)/m.test(sample)) signals += 1;
  if (/^>\s/m.test(sample)) signals += 1;
  if (/[├└│]──/.test(sample)) signals += 1;
  if (/^---$/m.test(sample)) signals += 1;

  const proseRatio = (sample.match(/[a-zA-Z]{4,}/g) ?? []).length / Math.max(sample.length, 1);
  const codeFenceRatio = (sample.match(/```/g) ?? []).length;
  if (proseRatio > 0.08 && codeFenceRatio >= 2) signals += 1;

  return signals >= 3;
}