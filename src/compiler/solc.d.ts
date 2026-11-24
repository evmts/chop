declare module "solc" {
	const solc: {
		compile(input: string, callbacks?: { import: (path: string) => { contents: string } | { error: string } }): string
		version(): string
	}
	export default solc
}
