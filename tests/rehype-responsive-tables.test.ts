import { describe, expect, it } from 'vitest';
import rehypeResponsiveTables from '../src/lib/rehype-responsive-tables';

interface Node {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

const text = (value: string): Node => ({ type: 'text', value });
const element = (tagName: string, children: Node[] = []): Node => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});
const row = (tagName: string, cells: string[]): Node =>
  element('tr', [text('\n'), ...cells.map((cell) => element(tagName, [text(cell)]))]);

function table(header: string[], rows: string[][]): Node {
  return element('table', [
    element('thead', [row('th', header)]),
    text('\n'),
    element('tbody', rows.map((cells) => row('td', cells))),
  ]);
}

function run(node: Node): Node {
  const root = element('root', [node]);
  rehypeResponsiveTables()(root);
  return node;
}

const cells = (node: Node, tagName: string): Node[] => {
  const found: Node[] = [];
  const walk = (current: Node) => {
    if (current.tagName === tagName) found.push(current);
    current.children?.forEach(walk);
  };
  walk(node);
  return found;
};

describe('rehypeResponsiveTables', () => {
  it('labels cells of a table with three or more columns', () => {
    const result = run(table(['', 'Warehouse', 'Lake'], [['Format', 'Proprietary', 'Open']]));

    expect(result.properties).toMatchObject({
      className: ['table-stack'],
      dataColumns: 3,
      role: 'table',
    });
    expect(cells(result, 'td').map((cell) => cell.properties)).toEqual([
      { role: 'cell' },
      { role: 'cell', dataLabel: 'Warehouse' },
      { role: 'cell', dataLabel: 'Lake' },
    ]);
    expect(cells(result, 'th').every((cell) => cell.properties?.role === 'columnheader')).toBe(true);
    expect(cells(result, 'tr').every((cell) => cell.properties?.role === 'row')).toBe(true);
    expect(cells(result, 'tbody')[0]?.properties?.role).toBe('rowgroup');
  });

  it('uses the plain text of formatted headers', () => {
    const header = element('tr', [
      element('th', [text('Code')]),
      element('th', [element('code', [text('status')]), text(' meaning')]),
      element('th', [text('Action')]),
    ]);
    const result = run(
      element('table', [element('thead', [header]), element('tbody', [row('td', ['a', 'b', 'c'])])]),
    );

    expect(cells(result, 'td')[1]?.properties?.dataLabel).toBe('status meaning');
  });

  it('keeps a two-column table as a table', () => {
    const result = run(table(['Key', 'Action'], [['i', 'Insert']]));

    expect(result.properties).toEqual({ dataColumns: 2 });
    expect(cells(result, 'td').every((cell) => Object.keys(cell.properties ?? {}).length === 0)).toBe(
      true,
    );
  });

  it('leaves a table without a header untouched', () => {
    const result = run(element('table', [element('tbody', [row('td', ['a', 'b', 'c'])])]));

    expect(result.properties).toEqual({});
  });
});
