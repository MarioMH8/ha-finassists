import { useLocale } from '@app/i18n/locale-context';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { SharedExpensesManagement } from './shared-expenses-management';
import styles from './shared-expenses-workspace.module.css';

interface Book {
	archivedAt: null | string;
	currencyCode: string;
	id: string;
	isDefault: boolean;
	name: string;
}

function isBook(value: unknown): value is Book {
	return (
		typeof value === 'object' &&
		value !== null &&
		'archivedAt' in value &&
		(value.archivedAt === null || typeof value.archivedAt === 'string') &&
		'currencyCode' in value &&
		typeof value.currencyCode === 'string' &&
		'id' in value &&
		typeof value.id === 'string' &&
		'isDefault' in value &&
		typeof value.isDefault === 'boolean' &&
		'name' in value &&
		typeof value.name === 'string'
	);
}

const COPY = {
	en: {
		book: 'Book',
		loadError: 'Could not load books.',
		loading: 'Loading books…',
		noBooks: 'Create a book before managing shared expenses.',
	},
	es: {
		book: 'Libro',
		loadError: 'No se pudieron cargar los libros.',
		loading: 'Cargando libros…',
		noBooks: 'Crea un libro antes de gestionar gastos compartidos.',
	},
} as const;

function SharedExpensesWorkspace(): ReactElement {
	const { language } = useLocale();
	const copy = COPY[language];
	const [books, setBooks] = useState<Book[]>([]);
	const [bookId, setBookId] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const book = books.find(item => item.id === bookId);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError('');
		void fetch('/api/v1/books', { signal: controller.signal })
			.then(async response => {
				if (!response.ok) {
					throw new Error(copy.loadError);
				}
				const result: unknown = await response.json();
				if (
					typeof result !== 'object' ||
					result === null ||
					!('items' in result) ||
					!Array.isArray(result.items) ||
					!result.items.every(isBook)
				) {
					throw new TypeError(copy.loadError);
				}
				const availableBooks = result.items.filter(item => !item.archivedAt);
				setBooks(availableBooks);
				setBookId(current =>
					availableBooks.some(item => item.id === current)
						? current
						: (availableBooks.find(item => item.isDefault)?.id ?? availableBooks.at(0)?.id ?? '')
				);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(copy.loadError);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			});

		return () => controller.abort();
	}, [copy.loadError]);

	return (
		<div className={styles.workspace}>
			{books.length > 1 && (
				<label className={styles['workspace-book']}>
					{copy.book}
					<select
						onChange={event => setBookId(event.currentTarget.value)}
						value={bookId}>
						{books.map(item => (
							<option
								key={item.id}
								value={item.id}>
								{item.name}
							</option>
						))}
					</select>
				</label>
			)}
			{loading && <p role='status'>{copy.loading}</p>}
			{error && <p role='alert'>{error}</p>}
			{!loading && !error && !book && <p>{copy.noBooks}</p>}
			{book && (
				<SharedExpensesManagement
					bookId={book.id}
					currencyCode={book.currencyCode}
				/>
			)}
		</div>
	);
}

export { SharedExpensesWorkspace };
