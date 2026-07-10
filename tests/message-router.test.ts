import { describe, it, expect, vi } from 'vitest';
import { dispatchMessage, type RouteTable } from '../src/message-router';

const sender = { id: 'ext' } as chrome.runtime.MessageSender;

describe('dispatchMessage', () => {
  it('rejects unknown types and bad payloads', () => {
    const send = vi.fn();
    expect(dispatchMessage({}, null, sender, send)).toBe(false);
    expect(dispatchMessage({}, { type: 'nope' }, sender, send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('enforces allow guards', () => {
    const send = vi.fn();
    const routes: RouteTable = {
      ping: {
        allow: () => false,
        async: true,
        handle: (_m, _s, sr) => sr({ success: true }),
      },
    };
    expect(dispatchMessage(routes, { type: 'ping' }, sender, send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps channel open for async handlers', async () => {
    const send = vi.fn();
    const routes: RouteTable = {
      work: {
        allow: () => true,
        async: true,
        handle: async (_m, _s, sr) => {
          sr({ success: true, ok: 1 });
        },
      },
    };
    expect(dispatchMessage(routes, { type: 'work' }, sender, send)).toBe(true);
    await Promise.resolve();
    expect(send).toHaveBeenCalledWith({ success: true, ok: 1 });
  });

  it('returns false for fire-and-forget routes', () => {
    const send = vi.fn();
    let ran = false;
    const routes: RouteTable = {
      fire: {
        allow: () => true,
        async: false,
        handle: () => {
          ran = true;
        },
      },
    };
    expect(dispatchMessage(routes, { type: 'fire' }, sender, send)).toBe(false);
    expect(ran).toBe(true);
  });
});
