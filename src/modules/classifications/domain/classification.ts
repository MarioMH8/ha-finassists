import { ClassificationError } from './classification.error';

const JSON_NULL = JSON.parse('null') as null;

const CLASSIFICATION_KIND = {
	CATEGORY: 'category',
	CLASS: 'class',
} as const;

type ClassificationKind = (typeof CLASSIFICATION_KIND)[keyof typeof CLASSIFICATION_KIND];

interface ClassificationFields {
	archivedAt: null | string;
	bookId: string;
	id: string;
	name: string;
	parentId: null | string;
}

interface ClassificationInput {
	archivedAt?: null | string;
	bookId: string;
	id: string;
	name: string;
	parentId?: null | string;
}

interface ClassificationCreateInput {
	bookId: string;
	id: string;
	name: string;
}

const classificationLabels: Record<ClassificationKind, string> = {
	category: 'Category',
	class: 'Class',
};

const classificationNameMaxLength = 80;

class Classification implements ClassificationFields {
	readonly archivedAt: null | string;
	readonly bookId: string;
	readonly id: string;
	readonly name: string;
	readonly parentId: null | string;
	readonly #kind: ClassificationKind;

	private constructor(kind: ClassificationKind, input: ClassificationInput) {
		if (input.id.trim().length === 0) {
			throw new ClassificationError('invalid-id', `${classificationLabels[kind]} id must not be empty`);
		}

		if (input.bookId.trim().length === 0) {
			throw new ClassificationError('invalid-book-id', `${classificationLabels[kind]} book id must not be empty`);
		}

		this.#kind = kind;
		this.archivedAt = input.archivedAt ?? JSON_NULL;
		this.bookId = input.bookId;
		this.id = input.id;
		this.name = Classification.normalizeName(kind, input.name);
		this.parentId = input.parentId ?? JSON_NULL;
		Object.freeze(this);
	}

	static create(kind: ClassificationKind, input: ClassificationCreateInput): Classification {
		return this.reconstitute(kind, input);
	}

	static normalizeName(kind: ClassificationKind, name: string): string {
		const normalized = name.trim();
		// Code points, not UTF-16 units, to match the SQLite length() CHECK
		// eslint-disable-next-line typescript/no-misused-spread
		const length = [...normalized].length;
		if (length < 1 || length > classificationNameMaxLength) {
			throw new ClassificationError(
				'invalid-name',
				`${classificationLabels[kind]} name must contain between 1 and ${String(classificationNameMaxLength)} characters`
			);
		}

		return normalized;
	}

	static reconstitute(kind: ClassificationKind, input: ClassificationInput): Classification {
		return new this(kind, input);
	}

	archive(at: string): Classification {
		if (this.archivedAt !== null) {
			return this;
		}

		return Classification.reconstitute(this.#kind, this.#with({ archivedAt: at }));
	}

	rename(name: string): Classification {
		return Classification.reconstitute(this.#kind, this.#with({ name }));
	}

	reparent(parent: Classification | undefined, isCycle: boolean): Classification {
		if (parent !== undefined && parent.bookId !== this.bookId) {
			throw new ClassificationError(
				'parent-not-found',
				`Parent for ${this.id} was not found in book ${this.bookId}`
			);
		}

		if (parent !== undefined && parent.archivedAt !== null) {
			throw new ClassificationError('parent-archived', `Parent ${parent.id} is archived`);
		}

		if (isCycle) {
			throw new ClassificationError(
				'cycle',
				`${classificationLabels[this.#kind]} ${this.id} cannot be moved below itself or one of its descendants`
			);
		}

		return Classification.reconstitute(this.#kind, this.#with({ parentId: parent?.id ?? JSON_NULL }));
	}

	restore(parent: Classification | undefined): Classification {
		if (this.archivedAt === null) {
			return this;
		}

		if (this.parentId !== null && parent?.id !== this.parentId) {
			throw new ClassificationError(
				'parent-not-found',
				`Parent for ${this.id} was not found in book ${this.bookId}`
			);
		}

		if (parent !== undefined && this.parentId !== null && parent.bookId !== this.bookId) {
			throw new ClassificationError(
				'parent-not-found',
				`Parent for ${this.id} was not found in book ${this.bookId}`
			);
		}

		if (parent !== undefined && parent.archivedAt !== null) {
			throw new ClassificationError('parent-archived', `Parent ${parent.id} is archived`);
		}

		return Classification.reconstitute(this.#kind, this.#with({ archivedAt: JSON_NULL }));
	}

	#with(input: Partial<ClassificationInput>): ClassificationInput {
		return {
			// Explicit null clears archival state during restore; undefined keeps the current value.
			archivedAt: input.archivedAt === undefined ? this.archivedAt : input.archivedAt,
			bookId: this.bookId,
			id: this.id,
			name: input.name ?? this.name,
			parentId: input.parentId === undefined ? this.parentId : input.parentId,
		};
	}
}

export {
	Classification,
	CLASSIFICATION_KIND,
	type ClassificationCreateInput,
	type ClassificationFields,
	type ClassificationInput,
	type ClassificationKind,
	classificationLabels,
	classificationNameMaxLength,
};
