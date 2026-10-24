import type { Classification, ClassificationKind } from '@modules/classifications/domain/classification';

/**
 * Port for one classification dimension. Every operation is scoped to a book;
 * an id from another book is indistinguishable from a missing one.
 */
interface ClassificationRepository<K extends ClassificationKind = ClassificationKind> {
	readonly kind: K;
	/**
	 *Archives the classification and all its descendants; returns the number of rows archived.
	 */
	archiveSubtree(bookId: string, id: string, archivedAt: string): number;
	bookState(bookId: string): 'active' | 'archived' | undefined;
	create(classification: Classification): void;
	delete(bookId: string, id: string): boolean;
	find(bookId: string, id: string): Classification | undefined;
	hasChildren(bookId: string, id: string): boolean;
	isInUse(bookId: string, id: string): boolean;
	/**
	 *True when `candidateId` equals `ancestorId` or is nested anywhere below it.
	 */
	isSelfOrDescendant(bookId: string, ancestorId: string, candidateId: string): boolean;
	/**
	 *Ordered by name (case-insensitive, then exact), then id.
	 */
	list(bookId: string, options?: { includeArchived?: boolean }): Classification[];
	/**
	 *Persists name, parent and archive state of an existing classification.
	 */
	save(classification: Classification): void;
}

type CategoryRepository = ClassificationRepository<'category'>;
type ClassRepository = ClassificationRepository<'class'>;

export type { CategoryRepository, ClassificationRepository, ClassRepository };
