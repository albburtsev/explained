interface DirectiveNode {
  type: string;
  name?: string;
  value?: string;
  data?: {
    hName?: string;
    directiveLabel?: boolean;
  };
  children?: DirectiveNode[];
}

const fallbackLabel = 'Details';

function summaryNode(): DirectiveNode {
  return {
    type: 'paragraph',
    data: { hName: 'summary' },
    children: [{ type: 'text', value: fallbackLabel }],
  };
}

function transform(node: DirectiveNode): void {
  if (node.type === 'containerDirective' && node.name === 'details') {
    node.data = { ...node.data, hName: 'details' };

    const children = node.children ?? [];
    const label = children[0];

    if (label?.data?.directiveLabel) {
      label.data = { ...label.data, hName: 'summary' };
    } else {
      children.unshift(summaryNode());
    }

    node.children = children;
  }

  node.children?.forEach(transform);
}

export default function remarkDetails() {
  return (tree: unknown): void => {
    transform(tree as DirectiveNode);
  };
}
