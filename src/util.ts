import * as chalk from 'chalk';

export function exit(exitCode: number): never {
	console.log(chalk.red(`Process exiting with code '${exitCode}'.`));
	process.exit(exitCode);
}

export function createGetCanonicalFileName(useCaseSensitiveFileNames: boolean) {
	return useCaseSensitiveFileNames ? (t: string) => t : (t: string) => t.toLowerCase();
}