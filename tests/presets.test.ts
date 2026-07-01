import { describe, it, expect } from 'vitest';
import { COMMUNITY_AI_CHAT_DOMAINS } from '../src/presets';
import { isDomainMatch } from '../src/utils';

const HOSTNAME_PATTERN = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

describe('COMMUNITY_AI_CHAT_DOMAINS', () => {
  it('contains only valid hostname patterns', () => {
    for (const domain of COMMUNITY_AI_CHAT_DOMAINS) {
      expect(domain, `invalid preset: ${domain}`).toMatch(HOSTNAME_PATTERN);
    }
  });

  it('has no duplicate entries', () => {
    const unique = new Set(COMMUNITY_AI_CHAT_DOMAINS);
    expect(unique.size).toBe(COMMUNITY_AI_CHAT_DOMAINS.length);
  });

  it('matches core AI chat hosts including common subdomains', () => {
    const cases: Array<[string, boolean]> = [
      ['chatgpt.com', true],
      ['chat.openai.com', true],
      ['claude.ai', true],
      ['www.perplexity.ai', true],
      ['labs.perplexity.ai', true],
      ['chat.openrouter.ai', true],
      ['www.you.com', true],
      ['beta.character.ai', true],
      ['notebooklm.google.com', true],
      ['aistudio.google.com', true],
      ['v0.dev', true],
      ['huggingface.co', true],
      ['example.com', false],
      ['notebooklm.google', false],
      ['intercom.com', false],
    ];

    const patterns = [...COMMUNITY_AI_CHAT_DOMAINS];
    for (const [hostname, expected] of cases) {
      expect(isDomainMatch(hostname, patterns), hostname).toBe(expected);
    }
  });
});