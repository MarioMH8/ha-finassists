import type { Classification, ClassificationKind, ClassificationRepository } from '@modules/classifications/domain';
import { expect, mock } from 'bun:test';

export class MockClassificationRepository<
	K extends ClassificationKind = ClassificationKind,
> implements ClassificationRepository<K> {
	private readonly archiveSubtreeMock = mock<ClassificationRepository['archiveSubtree']>(() => 0);
	private readonly bookStateMock = mock<ClassificationRepository['bookState']>();
	private readonly createMock = mock<ClassificationRepository['create']>();
	private readonly deleteMock = mock<ClassificationRepository['delete']>(() => false);
	private readonly findMock = mock<ClassificationRepository['find']>();
	private readonly hasChildrenMock = mock<ClassificationRepository['hasChildren']>(() => false);
	private readonly isInUseMock = mock<ClassificationRepository['isInUse']>(() => false);
	private readonly isSelfOrDescendantMock = mock<ClassificationRepository['isSelfOrDescendant']>(() => false);
	private readonly listMock = mock<ClassificationRepository['list']>(() => []);
	private readonly saveMock = mock<ClassificationRepository['save']>();

	constructor(readonly kind: K) {}

	archiveSubtree(bookId: string, id: string, archivedAt: string): number {
		return this.archiveSubtreeMock(bookId, id, archivedAt);
	}

	assertArchiveSubtreeHasBeenCalledWith(bookId: string, id: string, archivedAt: string): void {
		expect(this.archiveSubtreeMock).toHaveBeenCalledWith(bookId, id, archivedAt);
	}

	assertArchiveSubtreeHasNotBeenCalled(): void {
		expect(this.archiveSubtreeMock).not.toHaveBeenCalled();
	}

	assertBookStateHasBeenCalledWith(bookId: string): void {
		expect(this.bookStateMock).toHaveBeenCalledWith(bookId);
	}

	assertCreateHasBeenCalledWith(classification: Classification): void {
		expect(this.createMock).toHaveBeenCalledWith(classification);
	}

	assertCreateHasNotBeenCalled(): void {
		expect(this.createMock).not.toHaveBeenCalled();
	}

	assertDeleteHasBeenCalledWith(bookId: string, id: string): void {
		expect(this.deleteMock).toHaveBeenCalledWith(bookId, id);
	}

	assertDeleteHasNotBeenCalled(): void {
		expect(this.deleteMock).not.toHaveBeenCalled();
	}

	assertFindHasBeenCalledWith(bookId: string, id: string): void {
		expect(this.findMock).toHaveBeenCalledWith(bookId, id);
	}

	assertFindHasNotBeenCalled(): void {
		expect(this.findMock).not.toHaveBeenCalled();
	}

	assertHasChildrenHasBeenCalledWith(bookId: string, id: string): void {
		expect(this.hasChildrenMock).toHaveBeenCalledWith(bookId, id);
	}

	assertIsInUseHasBeenCalledWith(bookId: string, id: string): void {
		expect(this.isInUseMock).toHaveBeenCalledWith(bookId, id);
	}

	assertIsSelfOrDescendantHasBeenCalledWith(bookId: string, ancestorId: string, candidateId: string): void {
		expect(this.isSelfOrDescendantMock).toHaveBeenCalledWith(bookId, ancestorId, candidateId);
	}

	assertListHasBeenCalledWith(bookId: string, options?: { includeArchived?: boolean }): void {
		expect(this.listMock).toHaveBeenCalledWith(...(options === undefined ? [bookId] : [bookId, options]));
	}

	assertSaveHasBeenCalledWith(classification: Classification): void {
		expect(this.saveMock).toHaveBeenCalledWith(classification);
	}

	assertSaveHasNotBeenCalled(): void {
		expect(this.saveMock).not.toHaveBeenCalled();
	}

	bookState(bookId: string): 'active' | 'archived' | undefined {
		return this.bookStateMock(bookId);
	}

	create(classification: Classification): void {
		this.createMock(classification);
	}

	delete(bookId: string, id: string): boolean {
		return this.deleteMock(bookId, id);
	}

	find(bookId: string, id: string): Classification | undefined {
		return this.findMock(bookId, id);
	}

	hasChildren(bookId: string, id: string): boolean {
		return this.hasChildrenMock(bookId, id);
	}

	isInUse(bookId: string, id: string): boolean {
		return this.isInUseMock(bookId, id);
	}

	isSelfOrDescendant(bookId: string, ancestorId: string, candidateId: string): boolean {
		return this.isSelfOrDescendantMock(bookId, ancestorId, candidateId);
	}

	list(bookId: string, options?: { includeArchived?: boolean }): Classification[] {
		return options === undefined ? this.listMock(bookId) : this.listMock(bookId, options);
	}

	save(classification: Classification): void {
		this.saveMock(classification);
	}

	shouldArchiveSubtree(archivedCount: number): void {
		this.archiveSubtreeMock.mockReturnValue(archivedCount);
	}

	shouldBeInUse(isInUse: boolean): void {
		this.isInUseMock.mockReturnValue(isInUse);
	}

	shouldBeSelfOrDescendant(isSelfOrDescendant: boolean): void {
		this.isSelfOrDescendantMock.mockReturnValue(isSelfOrDescendant);
	}

	shouldDelete(isDeleted: boolean): void {
		this.deleteMock.mockReturnValue(isDeleted);
	}

	shouldFind(classification: Classification | undefined): void {
		this.findMock.mockReturnValue(classification);
	}

	/**
	 *Answers consecutive `find` calls with the given values, in order.
	 */
	shouldFindInOrder(...classifications: (Classification | undefined)[]): void {
		for (const classification of classifications) {
			this.findMock.mockReturnValueOnce(classification);
		}
	}

	shouldHaveBookState(state: 'active' | 'archived' | undefined): void {
		this.bookStateMock.mockReturnValue(state);
	}

	shouldHaveChildren(hasChildren: boolean): void {
		this.hasChildrenMock.mockReturnValue(hasChildren);
	}

	shouldList(classifications: Classification[]): void {
		this.listMock.mockReturnValue(classifications);
	}
}
