import type { StatementImportRecord } from '@modules/imports/domain';
import { ImportError } from '@modules/imports/domain';
import type { LedgerRepository } from '@modules/ledger/domain';

import type { ImportDependencies, ImportRequest } from './plan-import';
import { planImport } from './plan-import';

interface CommitDependencies extends ImportDependencies {
	ledger: LedgerRepository;
}

interface ImportCommitResult {
	importId: string;
	importedAt: string;
	// `already-imported`: the same bytes were committed earlier for this book/account; nothing was written.
	status: 'already-imported' | 'imported';
	transactionIds: string[];
}

/**
 * Imports a previewed file in one atomic unit: the `statement_imports` marker and every transaction are
 * written together or not at all. Retrying the same bytes for the same book/account is a no-op that returns
 * the original import. Any invalid row rejects the whole file.
 */
class CommitStatementImport {
	constructor(private readonly dependencies: CommitDependencies) {}

	execute(request: ImportRequest): ImportCommitResult {
		const { imports, ledger } = this.dependencies;

		return imports.runAtomically(() => {
			const plan = planImport(this.dependencies, request);
			if (plan.existingImport) {
				return toResult(plan.existingImport, 'already-imported', []);
			}
			if (request.format === 'payee_csv') {
				throw new ImportError(
					'payee-directory-not-persistable',
					'A payee file cannot be committed: payees are stored on transactions and there is no payee table.'
				);
			}
			if (plan.counts.errors > 0) {
				throw new ImportError(
					'invalid-rows',
					`${String(plan.counts.errors)} row(s) are invalid; nothing was imported.`,
					{
						issues: plan.issues,
					}
				);
			}
			if (plan.rows.length === 0) {
				throw new ImportError('no-rows', 'The file contains no transactions.');
			}
			const record = imports.record({
				accountId: request.accountId,
				bookId: request.bookId,
				contentHash: plan.contentHash,
				format: request.format,
			});
			const transactionIds: string[] = [];
			for (const row of plan.rows) {
				try {
					transactionIds.push(ledger.create(row.input).id);
				} catch (error) {
					throw new ImportError(
						'commit-failed',
						`Line ${String(row.line)} could not be stored: ${(error as Error).message}`,
						{
							line: row.line,
						}
					);
				}
			}

			return toResult(record, 'imported', transactionIds);
		});
	}
}

function toResult(
	record: StatementImportRecord,
	status: ImportCommitResult['status'],
	transactionIds: string[]
): ImportCommitResult {
	return { importedAt: record.importedAt, importId: record.id, status, transactionIds };
}

export { type CommitDependencies, CommitStatementImport, type ImportCommitResult };
