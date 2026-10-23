export {
	type Classification,
	type ClassificationInput,
	type ClassificationKind,
	classificationLabels,
	classificationNameMaxLength,
	createClassification,
	normalizeClassificationName,
} from './classification';
export type { CategoryRepository, ClassificationRepository, ClassRepository } from './classification.repository';
export { ClassificationError, type ClassificationErrorCode } from './classification-error';
export { buildClassificationTree, type ClassificationNode } from './classification-tree';
