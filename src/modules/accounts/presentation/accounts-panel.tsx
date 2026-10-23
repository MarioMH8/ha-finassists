import type { Copy } from '@app/i18n';
import type { ReactElement, SubmitEvent } from 'react';

interface AccountView {
	closedAt: null | string;
	id: string;
	kind: string;
	name: string;
	openingBalanceMinor: number;
}

interface AccountBalanceView {
	postedMinor: number;
	reconciledMinor: number;
	totalMinor: number;
}

interface ConfirmActionProps {
	cancelLabel: string;
	className?: string;
	disabled?: boolean;
	label: string;
	onConfirm: () => void;
	prompt: string;
}

interface AccountsPanelProps {
	accountId: string;
	accounts: AccountView[];
	balances: Record<string, AccountBalanceView | undefined>;
	busy: boolean;
	copy: Copy;
	formatMoney: (value: number) => string;
	isIncludeClosed: boolean;
	loadingBookData: boolean;
	localized: (key: keyof Copy, fallback: string) => string;
	onAccountSelect: (id: string) => void;
	onIncludeClosedChange: (isIncludeClosed: boolean) => void;
	onSubmitAccount: (event: SubmitEvent<HTMLFormElement>) => void;
	onToggleAccount: (account: AccountView) => void;
	styles: Record<string, string>;
}

function AccountsPanel({
	accountId,
	accounts,
	balances,
	busy,
	copy,
	formatMoney,
	isIncludeClosed,
	loadingBookData,
	localized,
	onAccountSelect,
	onIncludeClosedChange,
	onSubmitAccount,
	onToggleAccount,
	styles,
}: AccountsPanelProps): ReactElement {
	return (
		<section
			aria-labelledby='accounts-heading'
			className={styles.card}>
			<div className={styles['section-title']}>
				<div>
					<h3 id='accounts-heading'>{copy.financeAccounts}</h3>
					<p>{copy.financeAccountsHelp}</p>
				</div>
				<label className={styles.check}>
					<input
						checked={isIncludeClosed}
						onChange={event => onIncludeClosedChange(event.currentTarget.checked)}
						type='checkbox'
					/>
					{copy.financeIncludeClosed}
				</label>
			</div>
			{loadingBookData ? (
				<p role='status'>{copy.financeLoading}</p>
			) : accounts.length > 0 ? (
				<ul className={styles.list}>
					{accounts.map(account => (
						<li
							className={`${styles.row} ${account.id === accountId ? styles['selected-row'] : ''}`}
							key={account.id}>
							<button
								className={styles['account-button']}
								onClick={() => onAccountSelect(account.id)}
								type='button'>
								<strong>{account.name}</strong>
								<span>
									{localized(`financeKind_${account.kind}` as keyof Copy, account.kind)}
									{account.closedAt ? ` · ${copy.financeClosed}` : ''}
								</span>
							</button>
							<div className={styles.balance}>
								<strong>
									{formatMoney(balances[account.id]?.totalMinor ?? account.openingBalanceMinor)}
								</strong>
								<small>
									{copy.financePosted}:{' '}
									{formatMoney(balances[account.id]?.postedMinor ?? account.openingBalanceMinor)}
								</small>
							</div>
							<button
								className={styles.secondary}
								disabled={busy}
								onClick={() => onToggleAccount(account)}
								type='button'>
								{account.closedAt ? copy.financeOpen : copy.financeClose}
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className={styles.empty}>{copy.financeNoAccounts}</p>
			)}
			<form
				className={styles['inline-form']}
				onSubmit={onSubmitAccount}>
				<label>
					{copy.financeAccountName}
					<input
						autoComplete='off'
						maxLength={80}
						name='name'
						required
					/>
				</label>
				<label>
					{copy.financeAccountType}
					<select name='kind'>
						<option value='checking'>{copy.financeKind_checking}</option>
						<option value='savings'>{copy.financeKind_savings}</option>
						<option value='credit'>{copy.financeKind_credit}</option>
						<option value='asset'>{copy.financeKind_asset}</option>
						<option value='liability'>{copy.financeKind_liability}</option>
					</select>
				</label>
				<label>
					{copy.financeOpeningBalance}
					<input
						defaultValue='0'
						inputMode='decimal'
						name='openingBalance'
						required
						step='any'
						type='number'
					/>
				</label>
				<button
					disabled={busy}
					type='submit'>
					{copy.financeCreateAccount}
				</button>
			</form>
		</section>
	);
}

export { type AccountBalanceView, AccountsPanel, type AccountView, type ConfirmActionProps };
