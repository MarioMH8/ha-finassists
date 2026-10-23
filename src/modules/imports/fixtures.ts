import { Buffer } from 'node:buffer';

/*
 * Provenance: every value below is synthetic and hand-written for these tests (fictional payees and amounts).
 * The layouts follow the documented dialects in domain/qif.ts, domain/payee-csv.ts and domain/statement-csv.ts.
 */
const encoder = new TextEncoder();

const toUtf8 = (text: string): Uint8Array => encoder.encode(text);
// Windows-1252 and Latin-1 agree on the accented letters used by the fixtures.
const toWindows1252 = (text: string): Uint8Array => Buffer.from(text, 'latin1');

const QIF_BASIC = [
	'!Type:Bank',
	'D05/01/2024',
	'T-12,50',
	'PCafé Demo',
	'MLunch',
	'N0001',
	'LFood',
	'^',
	'D06/01/2024',
	'T1 234,56',
	'PEmployer Demo',
	'^',
	'',
].join('\r\n');

const QIF_OPTION_AND_SPLIT = [
	'!Option:AutoSwitch',
	'!Type:Bank',
	`D07/01'24`,
	'T-20.00',
	'PShop Demo',
	'CX',
	'L[Savings Demo]',
	'SFood',
	'$-20.00',
	'^',
	'',
].join('\n');

const PAYEE_CSV = ['Lib;Code;Actif', 'Café Demo;CD1;1', 'Shop Demo;SD1;0', ''].join('\r\n');

const STATEMENT_CSV = [
	'date,amount,payee,memo',
	'2024-02-01,-9.99,Streaming Demo,Monthly',
	'2024-02-02,100.00,Employer Demo,"Salary, February"',
	'',
].join('\n');

export { PAYEE_CSV, QIF_BASIC, QIF_OPTION_AND_SPLIT, STATEMENT_CSV, toUtf8, toWindows1252 };
