const esbuild = require("esbuild");
const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

function obfuscateBundle(filePath) {
	const code = fs.readFileSync(filePath, 'utf8');
	const startTime = Date.now();

	const result = JavaScriptObfuscator.obfuscate(code, {
		// Совместимость с Node.js
		target: 'node',

		// Компактность + упрощения
		compact: true,
		simplify: true,

		// Префикс имён
		identifiersPrefix: 'gx_',

		// Рандомные короткие имена вместо _0xabc123
		identifierNamesGenerator: 'mangled-shuffled',

		// НЕ трогаем глобальные имена — сломает VS Code API
		renameGlobals: false,

		// НЕ переименовывать поля объектов — сломает работу с внешними API
		renameProperties: false,

		// Строки: всё через массив с rc4-шифрованием
		stringArray: true,
		stringArrayThreshold: 1,
		stringArrayEncoding: ['rc4'],
		stringArrayRotate: true,
		stringArrayShuffle: true,
		stringArrayWrappersCount: 3,
		stringArrayWrappersChainedCalls: true,
		stringArrayWrappersParametersMaxCount: 5,
		stringArrayWrappersType: 'function',

		// Разбиение строк на мелкие куски
		splitStrings: true,
		splitStringsChunkLength: 5,

		// Unicode-escape — код превратится в кашу из \u1234
		unicodeEscapeSequence: true,

		// Числа → выражения (5 → 2+3, 10 → 5*2)
		numbersToExpressions: true,

		// Самозащита — код самопроверяет, не отформатирован ли он
		selfDefending: true,

		// Control flow flattening — на максимум
		controlFlowFlattening: true,
		controlFlowFlatteningThreshold: 1,

		// Мёртвый код — фейковые ветки, которые никогда не выполняются
		deadCodeInjection: true,
		deadCodeInjectionThreshold: 0.4,

		// НЕ включаем debugProtection — он в VS Code может подвесить редактор
		debugProtection: false,
		debugProtectionInterval: 0,
		disableConsoleOutput: false,
	});

	fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`[obfuscate] dist/extension.js obfuscated in ${elapsed}s`);
}

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();

		// Обфускация только в production-сборке и только когда нет watch
		if (production) {
			const outPath = path.resolve(__dirname, 'dist', 'extension.js');
			obfuscateBundle(outPath);
		}
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});