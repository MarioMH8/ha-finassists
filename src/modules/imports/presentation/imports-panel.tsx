import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import type { ReactElement } from 'react';

interface AccountOptionView {
	closedAt: null | string;
	id: string;
	name: string;
}

interface ImportPreviewView {
	canCommit: boolean;
	currencyCode: string;
	errorCount: number;
	format: 'payee_csv' | 'qif' | 'statement_csv';
	ignoredFields: Record<string, number>;
	issues: { code: string; line: number; message: string; severity: string }[];
	payeeDirectory: { active: boolean; code: string; line: number; name: string }[];
	payeesNormalized: number;
	rows: {
		amountMinor: number;
		line: number;
		memo: string;
		payee: string;
		possibleDuplicate: boolean;
		transactionDate: string;
	}[];
	summary: { firstDate: null | string; lastDate: null | string; rowCount: number; totalMinor: number };
	warningCount: number;
}

interface ImportsPanelProps {
	accountId: string;
	accounts: AccountOptionView[];
	busy: boolean;
	copy: Copy;
	formatDate: (value: string, language: Language) => string;
	formatMinorUnits: (value: number, currency: string, language: Language) => string;
	formatMoney: (value: number) => string;
	importFile: File | undefined;
	importFormat: ImportPreviewView['format'];
	language: Language;
	onAccountChange: (id: string) => void;
	onCommit: () => void;
	onFormatChange: (format: ImportPreviewView['format']) => void;
	onImportFileChange: (file: File | undefined) => void;
	onPayeeFileChange: (file: File | undefined) => void;
	onPreview: () => void;
	preview: ImportPreviewView | undefined;
	styles: Record<string, string>;
}

function ImportsPanel({
	accountId,
	accounts,
	busy,
	copy,
	formatDate,
	formatMinorUnits,
	formatMoney,
	importFile,
	importFormat,
	language,
	onAccountChange,
	onCommit,
	onFormatChange,
	onImportFileChange,
	onPayeeFileChange,
	onPreview,
	preview,
	styles,
}: ImportsPanelProps): ReactElement {
	return (
		<section className={styles.card}>
			<h3>{copy.financeImport}</h3>
			<p>{copy.financeImportHelp}</p>
			<div className={styles['form-grid']}>
				<label>
					{copy.financeAccount}
					<select
						onChange={event => onAccountChange(event.currentTarget.value)}
						value={accountId}>
						{accounts
							.filter(item => !item.closedAt)
							.map(item => (
								<option
									key={item.id}
									value={item.id}>
									{item.name}
								</option>
							))}
					</select>
				</label>
				<label>
					{copy.financeImportFormat}
					<select
						name='importFormat'
						onChange={event => onFormatChange(event.currentTarget.value as ImportPreviewView['format'])}
						value={importFormat}>
						<option value='qif'>{copy.financeFormatQif}</option>
						<option value='statement_csv'>{copy.financeFormatStatementCsv}</option>
						<option value='payee_csv'>{copy.financeFormatPayeeCsv}</option>
					</select>
				</label>
				<label>
					{copy.financeImportFile}
					<input
						accept='.qif,.csv,text/csv,text/plain'
						onChange={event => onImportFileChange(event.currentTarget.files?.[0])}
						type='file'
					/>
				</label>
				<label>
					{copy.financePayeeDirectory}
					<input
						accept='.csv,text/csv'
						onChange={event => onPayeeFileChange(event.currentTarget.files?.[0])}
						type='file'
					/>
				</label>
			</div>
			<p className={styles.hint}>{copy.financeStatementCsvHint}</p>
			<div className={styles['row-actions']}>
				<button
					disabled={busy || !importFile || !accountId}
					onClick={onPreview}
					type='button'>
					{copy.financePreviewImport}
				</button>
				<button
					className={styles.secondary}
					disabled={busy || !preview?.canCommit}
					onClick={onCommit}
					type='button'>
					{copy.financeCommitImport}
				</button>
			</div>
			{preview && (
				<div
					aria-live='polite'
					className={styles.preview}
					role='status'>
					<h4>{copy.financePreview}</h4>
					<p>
						{copy.financeImportRows}: {String(preview.summary.rowCount)} · {copy.financeImportTotal}:{' '}
						{formatMinorUnits(preview.summary.totalMinor, preview.currencyCode, language)}
					</p>
					{preview.summary.firstDate && preview.summary.lastDate && (
						<p>
							{copy.financeImportDateRange}: {formatDate(preview.summary.firstDate, language)} –{' '}
							{formatDate(preview.summary.lastDate, language)}
						</p>
					)}
					{preview.errorCount > 0 && (
						<span className={styles.badge}>
							{copy.financeImportErrors}: {String(preview.errorCount)}
						</span>
					)}
					{preview.warningCount > 0 && (
						<span className={styles.badge}>
							{copy.financeImportWarnings}: {String(preview.warningCount)}
						</span>
					)}
					{preview.payeesNormalized > 0 && (
						<span className={styles.badge}>
							{copy.financeImportNormalizedPayees}: {String(preview.payeesNormalized)}
						</span>
					)}
					{preview.rows.length > 0 && (
						<div className={styles['table-wrap']}>
							<table>
								<thead>
									<tr>
										<th>{copy.financeDate}</th>
										<th>{copy.financePayee}</th>
										<th>{copy.financeAmount}</th>
										<th>{copy.financeMemo}</th>
									</tr>
								</thead>
								<tbody>
									{preview.rows.map(row => (
										<tr key={String(row.line)}>
											<td>{formatDate(row.transactionDate, language)}</td>
											<td>
												{row.payee || '—'}
												{row.possibleDuplicate && (
													<span className={styles.badge}>{copy.financeImportDuplicates}</span>
												)}
											</td>
											<td>{formatMoney(row.amountMinor)}</td>
											<td>{row.memo || '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					{preview.payeeDirectory.length > 0 && (
						<ul>
							{preview.payeeDirectory.map(entry => (
								<li key={`${entry.code}-${String(entry.line)}`}>
									{entry.code} — {entry.name}
								</li>
							))}
						</ul>
					)}
					{preview.issues.length > 0 && (
						<ul>
							{preview.issues.map(issue => (
								<li key={`${String(issue.line)}-${issue.code}`}>
									{copy.financeRow} {String(issue.line)}: {issue.message}
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</section>
	);
}

export { type ImportPreviewView, ImportsPanel };
