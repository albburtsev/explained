// Keeps the reader's place when the page is swapped for its translation.
// Translations mirror their source block by block, so the n-th block on one
// side is the n-th block on the other.

/** Blocks that can hold the reading position, in document order. */
export const anchorSelector = ':is(h1, h2, h3, h4, h5, h6, p, li, pre, tr, summary, blockquote, figure)';

/** Space kept between sticky chrome and the reading line. */
const readingLineGap = 16;

export interface BlockBox {
  /** Distance from the viewport top, as reported by `getBoundingClientRect`. */
  top: number;
  height: number;
}

export interface BlockPosition {
  index: number;
  /** Share of the block above the reading line, from 0 to 1. */
  fraction: number;
}

export interface ReadingAnchor extends BlockPosition {
  blockCount: number;
  /** Reading line distance from the viewport top. */
  lineY: number;
  /** Share of the scrollable height already scrolled, for the fallback. */
  pageFraction: number;
  openDetails: number[];
  detailsCount: number;
}

/**
 * Finds the innermost visible block under the reading line. In a gap it takes the next block
 * below; past the last block it takes the end of the last one.
 */
export function pickBlock(boxes: readonly BlockBox[], lineY: number): BlockPosition | undefined {
  let containing: BlockPosition | undefined;
  let below: BlockPosition | undefined;
  let above: BlockPosition | undefined;

  boxes.forEach(({ top, height }, index) => {
    if (height <= 0) return;
    if (top <= lineY && lineY < top + height) {
      // Descendants follow their ancestors, so the last match is the innermost block.
      containing = { index, fraction: (lineY - top) / height };
    } else if (top > lineY) {
      below ??= { index, fraction: 0 };
    } else {
      above = { index, fraction: 1 };
    }
  });

  return containing ?? below ?? above;
}

/** Page scroll offset that puts the given point of a block on the reading line. */
export function scrollTarget(box: BlockBox, scrollY: number, fraction: number, lineY: number): number {
  return Math.max(0, scrollY + box.top + fraction * box.height - lineY);
}

function anchorBlocks(): HTMLElement[] {
  const main = document.querySelector('main');
  if (!main) return [];
  return [...main.querySelectorAll<HTMLElement>(anchorSelector)].filter((block) => !block.closest('.breadcrumbs'));
}

function detailsBlocks(): HTMLDetailsElement[] {
  return [...document.querySelectorAll<HTMLDetailsElement>('main details')];
}

function readingLine(): number {
  const bottoms = [...document.querySelectorAll('.site-header, .breadcrumbs')]
    .map((element) => element.getBoundingClientRect().bottom);
  return Math.max(0, ...bottoms) + readingLineGap;
}

function scrollableHeight(): number {
  return document.documentElement.scrollHeight - window.innerHeight;
}

export function captureAnchor(): ReadingAnchor | undefined {
  const blocks = anchorBlocks();
  const lineY = readingLine();
  const position = pickBlock(blocks.map((block) => block.getBoundingClientRect()), lineY);
  if (!position) return undefined;

  const details = detailsBlocks();
  const height = scrollableHeight();
  return {
    ...position,
    blockCount: blocks.length,
    lineY,
    pageFraction: height > 0 ? window.scrollY / height : 0,
    openDetails: details.flatMap((element, index) => (element.open ? [index] : [])),
    detailsCount: details.length,
  };
}

/** Scrolls the swapped page to the anchored block and returns that block. */
export function restoreAnchor(anchor: ReadingAnchor): HTMLElement | undefined {
  const details = detailsBlocks();
  if (details.length === anchor.detailsCount) {
    anchor.openDetails.forEach((index) => {
      const element = details[index];
      if (element) element.open = true;
    });
  }

  const blocks = anchorBlocks();
  const block = blocks.length === anchor.blockCount ? blocks[anchor.index] : undefined;
  const top = block
    ? scrollTarget(block.getBoundingClientRect(), window.scrollY, anchor.fraction, anchor.lineY)
    : anchor.pageFraction * scrollableHeight();

  window.scrollTo({ left: 0, top, behavior: 'instant' });
  return block;
}

/** Briefly marks the block the reader was on; the animation lives in global.css. */
export function highlightBlock(block: HTMLElement): void {
  block.classList.remove('reading-anchor');
  // Restart the animation when the same block is marked twice in a row.
  void block.offsetWidth;
  block.classList.add('reading-anchor');
  block.addEventListener('animationend', () => block.classList.remove('reading-anchor'), { once: true });
}
