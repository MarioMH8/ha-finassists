function classNames(...values: (false | null | string | undefined)[]): string {
	return values.filter(Boolean).join(' ');
}

export { classNames };
