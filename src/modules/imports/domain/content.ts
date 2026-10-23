import { createHash } from 'node:crypto';

import { ImportError } from './import-error';
import type { ImportLimits } from './statement-import';

function assertWithinLimits(bytes: Uint8Array, limits: ImportLimits): void {
	if (bytes.byteLength === 0) {
		throw new ImportError('empty-file', 'The file is empty.');
	}
	if (bytes.byteLength > limits.maxBytes) {
		throw new ImportError(
			'file-too-large',
			`The file is ${String(bytes.byteLength)} bytes; the limit is ${String(limits.maxBytes)} bytes.`
		);
	}
}

// Idempotency key: SHA-256 of the raw uploaded bytes, so re-exporting an identical file is recognised.
function hashContent(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Decoding dialect: UTF-8 (BOM tolerated). When `allowWindows1252` is set (MS Comptes Bancaires QIF and
 * payee exports), bytes that are not valid UTF-8 are read as Windows-1252. UTF-16 and NUL bytes are rejected.
 */
function decodeText(bytes: Uint8Array, canDecodeWindows1252: boolean): string {
	if ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255)) {
		throw new ImportError('unsupported-encoding', 'UTF-16 files are not supported.');
	}
	if (bytes.includes(0)) {
		throw new ImportError('binary-content', 'The file contains NUL bytes and does not look like text.');
	}
	const hasBom = bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191;
	const body = hasBom ? bytes.subarray(3) : bytes;
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(body);
	} catch {
		if (!canDecodeWindows1252) {
			throw new ImportError('unsupported-encoding', 'The file is not valid UTF-8.');
		}
		text = new TextDecoder('windows-1252').decode(body);
	}
	if (text.trim().length === 0) {
		throw new ImportError('empty-file', 'The file contains only whitespace.');
	}

	return text;
}

export { assertWithinLimits, decodeText, hashContent };
