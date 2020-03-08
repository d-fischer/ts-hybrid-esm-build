import * as path from 'path';
import * as ts from 'typescript';

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
	return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function fileExists(fileName: string): boolean {
	return ts.sys.fileExists(fileName);
}

function readFile(fileName: string): string | undefined {
	return ts.sys.readFile(fileName);
}

function importExportVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
	const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
		let importPath: string | undefined;
		if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
			const importPathWithQuotes = node.moduleSpecifier.getText(sf);
			importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2);
		} else if (isDynamicImport(node)) {
			const importPathWithQuotes = node.arguments[0].getText(sf);
			importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2);
		}

		if (importPath) {
			if (importPath.startsWith('./') || importPath.startsWith('../')) {
				let transformedPath = importPath;
				const sourceFile = node.getSourceFile();
				if (sourceFile) {
					const result = ts.resolveModuleName(importPath, sourceFile.fileName, ctx.getCompilerOptions(), {
						fileExists,
						readFile
					});
					if (result.resolvedModule) {
						transformedPath = path.relative(
							path.dirname(sourceFile.fileName),
							result.resolvedModule.resolvedFileName
						);
						transformedPath =
							transformedPath.startsWith('./') || transformedPath.startsWith('../')
								? transformedPath
								: `./${transformedPath}`;
						transformedPath = transformedPath.replace(/\.ts$/, '.mjs');
					}
				}
				if (transformedPath !== importPath) {
					const newNode = ts.getMutableClone(node);
					if (ts.isImportDeclaration(newNode) || ts.isExportDeclaration(newNode)) {
						newNode.moduleSpecifier = ts.createLiteral(transformedPath);
					} else if (isDynamicImport(newNode)) {
						newNode.arguments = ts.createNodeArray([ts.createStringLiteral(transformedPath)]);
					}

					ts.setSourceMapRange(newNode, ts.getSourceMapRange(node));

					return newNode;
				}
			}
		}
		return ts.visitEachChild(node, visitor, ctx);
	};

	return visitor;
}

export function transform(): ts.TransformerFactory<ts.SourceFile> {
	return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => (sf: ts.SourceFile) =>
		ts.visitNode(sf, importExportVisitor(ctx, sf));
}