class McpSchemas {
	private constructor() {}

	static integerProperty(
		description: string,
		extra: Record<string, unknown> = {}
	): { description: string; type: string } {
		return { description, type: 'integer', ...extra };
	}

	static objectSchema(
		properties: Record<string, unknown> = {},
		required?: string[]
	): { properties: Record<string, unknown>; required?: string[]; type: 'object' } {
		return { properties, ...(required && { required }), type: 'object' as const };
	}

	static stringProperty(
		description: string,
		extra: Record<string, unknown> = {}
	): { description: string; type: string } {
		return { description, type: 'string', ...extra };
	}
}

export { McpSchemas };
