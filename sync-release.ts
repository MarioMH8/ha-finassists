import process from 'node:process';

/*
 * The app package owns the version. The Home Assistant app and the integration
 * manifest repeat it because each tool reads it from its own file, so this
 * script writes both from the package version and `--check` verifies them in CI.
 */
interface VersionTarget {
	file: string;
	prefix: string;
}

interface TargetState {
	contents: string;
	current: string;
	end: number;
	start: number;
	target: VersionTarget;
}

const CHECK_FLAG = '--check';
const PACKAGE_FILE = 'ha-finassists/package.json';
const TARGETS: VersionTarget[] = [
	{ file: 'ha-finassists/config.yaml', prefix: 'version: "' },
	{ file: 'custom_components/ha_finassists/manifest.json', prefix: '\t"version": "' },
];

function resolve(file: string): URL {
	return new URL(file, import.meta.url);
}

async function readPackageVersion(): Promise<string> {
	const packageJson: unknown = await Bun.file(resolve(PACKAGE_FILE)).json();

	if (typeof packageJson !== 'object' || packageJson === null || !('version' in packageJson)) {
		throw new TypeError(`${PACKAGE_FILE} declares no version`);
	}

	const { version } = packageJson;

	if (typeof version !== 'string') {
		throw new TypeError(`${PACKAGE_FILE} declares no version`);
	}

	return version;
}

async function inspectTarget(target: VersionTarget): Promise<TargetState> {
	const contents = await Bun.file(resolve(target.file)).text();
	const anchor = contents.indexOf(target.prefix);
	const start = anchor + target.prefix.length;
	const end = contents.indexOf('"', start);

	if (anchor === -1 || end === -1) {
		throw new Error(`${target.file} declares no version`);
	}

	return { contents, current: contents.slice(start, end), end, start, target };
}

async function writeTarget(state: TargetState, version: string): Promise<void> {
	const updated = `${state.contents.slice(0, state.start)}${version}${state.contents.slice(state.end)}`;

	await Bun.write(resolve(state.target.file), updated);
}

async function main(): Promise<number> {
	const isCheck = process.argv.includes(CHECK_FLAG);
	const version = await readPackageVersion();
	const states = await Promise.all(TARGETS.map(target => inspectTarget(target)));
	const stale = states.filter(state => state.current !== version);

	if (isCheck) {
		if (stale.length === 0) {
			process.stdout.write(`Version ${version} is in sync\n`);

			return 0;
		}

		for (const state of stale) {
			process.stderr.write(`${state.target.file} declares ${state.current}, expected ${version}\n`);
		}

		return 1;
	}

	await Promise.all(stale.map(state => writeTarget(state, version)));

	for (const state of stale) {
		process.stdout.write(`${state.target.file}: ${state.current} -> ${version}\n`);
	}

	if (stale.length === 0) {
		process.stdout.write(`Version ${version} is already in sync\n`);
	}

	return 0;
}

process.exitCode = await main();
