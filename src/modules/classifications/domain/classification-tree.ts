import type { Classification } from './classification';

interface ClassificationNode extends Classification {
	children: ClassificationNode[];
}

/**
 *Builds a forest preserving input order; entries whose parent is absent from the input become roots.
 */
function buildClassificationTree(classifications: readonly Classification[]): ClassificationNode[] {
	const nodes = new Map<string, ClassificationNode>();
	for (const classification of classifications) {
		nodes.set(classification.id, { ...classification, children: [] });
	}

	const roots: ClassificationNode[] = [];
	for (const classification of classifications) {
		const node = nodes.get(classification.id);
		if (!node) {
			continue;
		}

		const parent = classification.parentId === null ? undefined : nodes.get(classification.parentId);
		if (parent && parent !== node) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
	}

	return roots;
}

export { buildClassificationTree, type ClassificationNode };
