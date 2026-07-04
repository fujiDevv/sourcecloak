import { describe, expect, it } from 'vitest';
import { isMarkdownDocumentation } from '../src/markdown-doc';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('isMarkdownDocumentation', () => {
  it('detects README-style markdown', () => {
    const readme = readFileSync(
      resolve(import.meta.dirname, '../../../synapseclean-project/synapseclean/README.md'),
      'utf8'
    );
    expect(isMarkdownDocumentation(readme)).toBe(true);
  });

  it('detects pasted README excerpt', () => {
    const excerpt = `# SynapseClean

## Overview

| Capability | Description |
|------------|-------------|
| **Auto-compact** | Intercepts clipboard |

\`\`\`bash
bun install
bun run build
\`\`\`

[GitHub](https://github.com/fujiDevv/synapseclean)
`;
    expect(isMarkdownDocumentation(excerpt)).toBe(true);
  });

  it('does not classify raw source code as markdown docs', () => {
    const code = Array.from(
      { length: 12 },
      (_, i) => `export async function handler_${i}(secret_key: string) { return { token: process.env.API_KEY }; }`
    ).join('\n');
    expect(isMarkdownDocumentation(code)).toBe(false);
  });

  it('does not classify short plain text as markdown docs', () => {
    expect(isMarkdownDocumentation('hello team, meeting at 3pm')).toBe(false);
  });
});