import { describe, expect, it } from 'vitest';
import { pickBlock, scrollTarget } from '../src/lib/reading-anchor';

describe('pickBlock', () => {
  it('picks the block under the reading line with the share above it', () => {
    const boxes = [{ top: -200, height: 100 }, { top: -100, height: 200 }, { top: 100, height: 50 }];
    expect(pickBlock(boxes, 50)).toEqual({ index: 1, fraction: 0.75 });
  });

  it('prefers the innermost of nested blocks', () => {
    const boxes = [{ top: 0, height: 300 }, { top: 40, height: 60 }];
    expect(pickBlock(boxes, 70)).toEqual({ index: 1, fraction: 0.5 });
  });

  it('falls through to the next block when the line is in a gap', () => {
    const boxes = [{ top: -50, height: 40 }, { top: 30, height: 40 }, { top: 90, height: 40 }];
    expect(pickBlock(boxes, 10)).toEqual({ index: 1, fraction: 0 });
  });

  it('skips hidden blocks', () => {
    const boxes = [{ top: 0, height: 0 }, { top: 20, height: 40 }];
    expect(pickBlock(boxes, 0)).toEqual({ index: 1, fraction: 0 });
  });

  it('anchors to the end of the last block when every block is above the line', () => {
    expect(pickBlock([{ top: -200, height: 50 }, { top: -100, height: 50 }], 10)).toEqual({ index: 1, fraction: 1 });
  });

  it('returns nothing without visible blocks', () => {
    expect(pickBlock([{ top: 0, height: 0 }], 10)).toBeUndefined();
  });
});

describe('scrollTarget', () => {
  it('puts the same share of the block on the reading line', () => {
    expect(scrollTarget({ top: 900, height: 200 }, 0, 0.25, 100)).toBe(850);
    expect(scrollTarget({ top: -300, height: 100 }, 1000, 0.5, 80)).toBe(670);
  });

  it('never scrolls above the page top', () => {
    expect(scrollTarget({ top: 50, height: 100 }, 0, 0, 120)).toBe(0);
  });
});
