interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

// Tables with this many columns or more stack into labelled rows on narrow screens.
const stackThreshold = 3;

const roles: Record<string, string> = {
  table: 'table',
  thead: 'rowgroup',
  tbody: 'rowgroup',
  tr: 'row',
  th: 'columnheader',
  td: 'cell',
};

function isElement(node: HastNode, tagName?: string): boolean {
  return node.type === 'element' && (tagName === undefined || node.tagName === tagName);
}

function childElements(node: HastNode, tagName?: string): HastNode[] {
  return (node.children ?? []).filter((child) => isElement(child, tagName));
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

function addRoles(node: HastNode): void {
  const role = node.tagName ? roles[node.tagName] : undefined;
  if (role) node.properties = { ...node.properties, role };
  childElements(node).forEach(addRoles);
}

function transformTable(table: HastNode): void {
  const [thead] = childElements(table, 'thead');
  const [headerRow] = thead ? childElements(thead, 'tr') : [];
  if (!headerRow) return;

  const labels = childElements(headerRow).map((cell) => textContent(cell).trim());
  table.properties = { ...table.properties, dataColumns: labels.length };
  if (labels.length < stackThreshold) return;

  const className = table.properties.className;
  table.properties.className = [...(Array.isArray(className) ? className : []), 'table-stack'];

  childElements(table, 'tbody')
    .flatMap((tbody) => childElements(tbody, 'tr'))
    .forEach((row) => {
      childElements(row).forEach((cell, index) => {
        const label = labels[index];
        if (label) cell.properties = { ...cell.properties, dataLabel: label };
      });
    });

  addRoles(table);
}

function transform(node: HastNode): void {
  if (isElement(node, 'table')) {
    transformTable(node);
    return;
  }

  node.children?.forEach(transform);
}

export default function rehypeResponsiveTables() {
  return (tree: unknown): void => {
    transform(tree as HastNode);
  };
}
