/** Safe element lookup for Policy Console. */

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing required element #${id}`);
  }
  return node as T;
}

export function qsAll<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToLines(values: string[]): string {
  return values.join('\n');
}
