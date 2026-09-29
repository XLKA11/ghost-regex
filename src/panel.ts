import { checkDialect, Dialect, DialectWarning } from './dialects';
import * as vscode from 'vscode';
import { explainRegex } from './parser';
import { generateCode, TargetLanguage } from './generator';
import { snippets } from './snippets';
import { isPro, getPurchaseUrl } from './license';
import { detectRedos, RedosWarning } from './redos';
import { buildAstTree, AstLine } from './ast';
import { buildRailroad } from './railroad';
import { loadPatterns, savePattern, deletePattern } from './patterns';
import { loadTests, saveTests, RegexTest } from './tests';

export class GhostRegexPanel {
    public static currentPanel: GhostRegexPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;
    private static _syncBackUri: vscode.Uri | undefined;
    private static _syncBackSelection: vscode.Selection | undefined;

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._context = context;
        this._panel.webview.html = this._getHtml();

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'explain') {
                    const tokens = explainRegex(message.pattern);
                    let warnings: RedosWarning[] = [];
                    let ast: AstLine[] = [];
                    let railroadSvg: string | null = null;
                    let dialectWarnings: DialectWarning[] = [];
                    try {
                        warnings = detectRedos(message.pattern);
                    } catch (e) {
                        warnings = [];
                    }
                    try {
                        ast = buildAstTree(message.pattern);
                    } catch (e) {
                        ast = [];
                    }
                    try {
                        railroadSvg = buildRailroad(message.pattern);
                    } catch (e) {
                        railroadSvg = null;
                    }
                    try {
                        const dialect = (message.dialect || 'javascript') as Dialect;
                        dialectWarnings = checkDialect(message.pattern, dialect);
                    } catch (e) {
                        dialectWarnings = [];
                    }
                    this._panel.webview.postMessage({
                        command: 'result',
                        pattern: message.pattern,
                        tokens: tokens,
                        warnings: warnings,
                        ast: ast,
                        railroadSvg: railroadSvg,
                        dialectWarnings: dialectWarnings
                    });
                }

                if (message.command === 'generate') {
                    const result = generateCode(message.pattern, message.language as TargetLanguage);
                    this._panel.webview.postMessage({
                        command: 'generatedCode',
                        language: result.displayName,
                        code: result.code
                    });
                }

                if (message.command === 'copyToClipboard') {
                    await vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('Скопировано в буфер обмена');
                }

                if (message.command === 'applyBack') {
                    const ctx = GhostRegexPanel.getSyncBackContext();
                    if (!ctx) {
                        this._panel.webview.postMessage({
                            command: 'applyBackResult',
                            success: false,
                            error: 'Сначала откройте панель через «Объяснить выделенное» (правой кнопкой в коде).'
                        });
                        return;
                    }
                    try {
                        const document = await vscode.workspace.openTextDocument(ctx.uri);
                        const editor = await vscode.window.showTextDocument(document);
                        const ok = await editor.edit((editBuilder) => {
                            editBuilder.replace(ctx.selection, message.pattern);
                        });
                        if (ok) {
                            this._panel.webview.postMessage({
                                command: 'applyBackResult',
                                success: true
                            });
                            vscode.window.showInformationMessage('Regex заменён в редакторе');
                            GhostRegexPanel.clearSyncBackContext();
                        } else {
                            this._panel.webview.postMessage({
                                command: 'applyBackResult',
                                success: false,
                                error: 'Не удалось заменить regex'
                            });
                        }
                    } catch (e) {
                        this._panel.webview.postMessage({
                            command: 'applyBackResult',
                            success: false,
                            error: String(e)
                        });
                    }
                }

                if (message.command === 'saveCurrentPattern') {
                    if (!message.pattern || message.pattern.trim().length === 0) {
                        vscode.window.showWarningMessage('Нечего сохранять — поле пустое');
                        return;
                    }
                    const name = await vscode.window.showInputBox({
                        prompt: 'Название паттерна (можно оставить пустым)',
                        placeHolder: 'Например: Все числа',
                        ignoreFocusOut: true
                    });
                    if (name === undefined) {
                        return;
                    }
                    const ok = await savePattern(this._context, message.pattern, name || undefined);
                    if (ok) {
                        vscode.window.showInformationMessage('Паттерн сохранён');
                    } else {
                        vscode.window.showWarningMessage('Паттерн уже сохранён');
                    }
                    this._sendPatterns();
                }

                if (message.command === 'deleteSavedPattern') {
                    await deletePattern(this._context, message.pattern);
                    this._sendPatterns();
                }

                if (message.command === 'requestPatterns') {
                    this._sendPatterns();
                }

                if (message.command === 'requestTests') {
                    const tests = loadTests(this._context);
                    this._panel.webview.postMessage({
                        command: 'loadedTests',
                        tests: tests
                    });
                }

                if (message.command === 'saveTests') {
                    await saveTests(this._context, message.tests as RegexTest[]);
                }

                if (message.command === 'exportRailroad') {
                    try {
                        const saveUri = await vscode.window.showSaveDialog({
                            filters: { 'SVG': ['svg'] },
                            saveLabel: 'Сохранить диаграмму',
                            defaultUri: vscode.Uri.file('railroad-diagram.svg')
                        });
                        if (!saveUri) {
                            return;
                        }
                        await vscode.workspace.fs.writeFile(
                            saveUri,
                            Buffer.from(message.svg, 'utf8')
                        );
                        vscode.window.showInformationMessage('Диаграмма сохранена: ' + saveUri.fsPath);
                    } catch (e) {
                        vscode.window.showErrorMessage('Не удалось сохранить: ' + String(e));
                    }
                }

                if (message.command === 'selectFile') {
                    const uris = await vscode.window.showOpenDialog({
                        canSelectMany: false,
                        openLabel: 'Выбрать файл для Preview'
                    });
                    if (uris && uris.length > 0) {
                        const uri = uris[0];
                        try {
                            const raw = await vscode.workspace.fs.readFile(uri);
                            let text = Buffer.from(raw).toString('utf8');
                            const MAX = 50000;
                            let truncated = false;
                            if (text.length > MAX) {
                                text = text.substring(0, MAX);
                                truncated = true;
                            }
                            this._panel.webview.postMessage({
                                command: 'fileContent',
                                fileName: uri.fsPath,
                                content: text,
                                truncated: truncated
                            });
                        } catch (e) {
                            this._panel.webview.postMessage({
                                command: 'fileError',
                                error: String(e)
                            });
                        }
                    }
                }

                if (message.command === 'buyPro') {
                    vscode.env.openExternal(vscode.Uri.parse(getPurchaseUrl()));
                }
            },
            null,
            this._disposables
        );

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private _sendPatterns(): void {
        const patterns = loadPatterns(this._context);
        this._panel.webview.postMessage({
            command: 'savedPatterns',
            patterns: patterns
        });
    }

    public static setSyncBackContext(uri: vscode.Uri, selection: vscode.Selection): void {
        GhostRegexPanel._syncBackUri = uri;
        GhostRegexPanel._syncBackSelection = selection;
    }

    public static getSyncBackContext(): { uri: vscode.Uri; selection: vscode.Selection } | undefined {
        if (!GhostRegexPanel._syncBackUri || !GhostRegexPanel._syncBackSelection) {
            return undefined;
        }
        return {
            uri: GhostRegexPanel._syncBackUri,
            selection: GhostRegexPanel._syncBackSelection
        };
    }

    public static clearSyncBackContext(): void {
        GhostRegexPanel._syncBackUri = undefined;
        GhostRegexPanel._syncBackSelection = undefined;
    }

    public static createOrShow(context: vscode.ExtensionContext) {
        if (GhostRegexPanel.currentPanel) {
            GhostRegexPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'ghostRegex',
            'Ghost Regex',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        GhostRegexPanel.currentPanel = new GhostRegexPanel(panel, context);
    }

    public static createOrShowWithPattern(context: vscode.ExtensionContext, pattern: string) {
        if (GhostRegexPanel.currentPanel) {
            GhostRegexPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            setTimeout(() => {
                GhostRegexPanel.currentPanel?._panel.webview.postMessage({
                    command: 'setPattern',
                    pattern: pattern
                });
            }, 200);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'ghostRegex',
            'Ghost Regex',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        GhostRegexPanel.currentPanel = new GhostRegexPanel(panel, context);

        setTimeout(() => {
            GhostRegexPanel.currentPanel?._panel.webview.postMessage({
                command: 'setPattern',
                pattern: pattern
            });
        }, 300);
    }

    public static refresh(context: vscode.ExtensionContext): void {
        if (!GhostRegexPanel.currentPanel) {
            return;
        }
        GhostRegexPanel.currentPanel._context = context;
        GhostRegexPanel.currentPanel._panel.webview.html = GhostRegexPanel.currentPanel._getHtml();
    }

    public dispose() {
        GhostRegexPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }

    private _getSnippetsHtml(): string {
        const pro = isPro(this._context);
        const freeSnippets = ['Email', 'URL', 'IPv4'];

        const categories = new Map<string, typeof snippets>();
        for (const s of snippets) {
            if (!categories.has(s.category)) {
                categories.set(s.category, []);
            }
            categories.get(s.category)!.push(s);
        }

        let html = '';
        for (const [category, items] of categories) {
            html += `<details class="snippet-category">`;
            html += `<summary>${category} <span class="count">${items.length}</span></summary>`;
            html += `<div class="snippet-buttons">`;
            for (const s of items) {
                const escaped = s.pattern
                    .replace(/&/g, '&amp;')
                    .replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const locked = !pro && !freeSnippets.includes(s.name);
                const lockClass = locked ? ' locked' : '';
                const lockIcon = locked ? ' 🔒' : '';
                html += `<button class="snippet-btn${lockClass}" data-pattern="${escaped}" data-locked="${locked}">${s.name}${lockIcon}</button>`;
            }
            html += `</div></details>`;
        }

        return html;
    }

    private _getHtml(): string {
        const pro = isPro(this._context);
        const proBadge = pro ? 'PRO' : 'FREE';

        return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
    body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        padding: 16px;
        margin: 0;
    }
    h1 {
        font-size: 18px;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 3px;
        font-weight: bold;
        letter-spacing: 0.5px;
    }
    .badge.pro { background: var(--vscode-charts-green); color: white; }
    .badge.free { background: var(--vscode-descriptionForeground); color: var(--vscode-editor-background); }
    .tabs {
        display: flex;
        border-bottom: 1px solid var(--vscode-panel-border);
        margin-bottom: 16px;
    }
    .tab {
        padding: 8px 16px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        color: var(--vscode-descriptionForeground);
    }
    .tab.active {
        color: var(--vscode-foreground);
        border-bottom-color: var(--vscode-textLink-foreground);
    }
    .tab:hover { color: var(--vscode-foreground); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    input[type="text"], input:not([type]), select, textarea {
        width: 100%;
        padding: 8px;
        font-family: var(--vscode-editor-font-family);
        font-size: 14px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        box-sizing: border-box;
    }
    textarea {
        min-height: 80px;
        resize: vertical;
    }
    select { margin-top: 8px; }
    button {
        margin-top: 8px;
        padding: 8px 16px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        cursor: pointer;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .button-row {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
    }
    .button-row button { margin-top: 0; }
    .result { margin-top: 20px; }
    .token {
        display: flex;
        padding: 6px 0;
        border-bottom: 1px solid var(--vscode-panel-border);
    }
    .token-raw {
        font-family: var(--vscode-editor-font-family);
        font-weight: bold;
        min-width: 100px;
        color: var(--vscode-textLink-foreground);
    }
    .token-desc { flex: 1; }
    .empty {
        color: var(--vscode-descriptionForeground);
        font-style: italic;
    }
    pre {
        background: var(--vscode-editor-background);
        padding: 8px;
        overflow-x: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        max-height: 500px;
        overflow-y: auto;
        border: 1px solid var(--vscode-panel-border);
    }
    mark {
        background: var(--vscode-editor-findMatchHighlightBackground);
        color: inherit;
        padding: 1px 0;
    }
    .snippets { margin-top: 16px; }
    .snippets-title {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .snippet-category {
        margin-bottom: 4px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
    }
    .snippet-category summary {
        padding: 6px 10px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        user-select: none;
        background: var(--vscode-editor-background);
    }
    .snippet-category summary:hover {
        background: var(--vscode-list-hoverBackground);
    }
    .snippet-category .count {
        color: var(--vscode-descriptionForeground);
        font-weight: normal;
        font-size: 11px;
    }
    .snippet-buttons {
        padding: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .snippet-btn {
        padding: 4px 10px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        cursor: pointer;
        border-radius: 3px;
        margin: 0;
    }
    .snippet-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
    }
    .snippet-btn.locked {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .saved-patterns { margin-top: 16px; }
    .saved-patterns-title {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .saved-pattern-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        margin-bottom: 3px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        font-size: 12px;
    }
    .saved-pattern-name {
        flex: 1;
        cursor: pointer;
        font-family: var(--vscode-editor-font-family);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .saved-pattern-name:hover { color: var(--vscode-textLink-foreground); }
    .saved-pattern-delete {
        background: transparent;
        color: var(--vscode-descriptionForeground);
        border: none;
        cursor: pointer;
        padding: 2px 6px;
        margin: 0;
        font-size: 14px;
        line-height: 1;
    }
    .saved-pattern-delete:hover {
        color: var(--vscode-editorError-foreground);
        background: transparent;
    }
    .redos-warning {
        margin-top: 16px;
        padding: 12px 16px;
        border-left: 4px solid var(--vscode-editorWarning-foreground);
        background: var(--vscode-inputValidation-warningBackground);
        border-radius: 3px;
    }
    .redos-warning.danger {
        border-left-color: var(--vscode-editorError-foreground);
        background: var(--vscode-inputValidation-errorBackground);
    }
    .redos-title {
        font-weight: bold;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .redos-icon { font-size: 16px; }
    .redos-hint {
        font-size: 13px;
        line-height: 1.5;
        color: var(--vscode-foreground);
    }
    .redos-fix {
        margin-top: 8px;
        padding: 6px 10px;
        background: var(--vscode-editor-background);
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        border: 1px solid var(--vscode-panel-border);
    }
    .section-title {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin: 24px 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: bold;
    }
    .ast-tree {
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        padding: 8px 0;
        background: var(--vscode-editor-background);
    }
    .ast-line {
        display: flex;
        padding: 3px 12px;
        align-items: baseline;
    }
    .ast-line.root { color: var(--vscode-descriptionForeground); font-style: italic; }
    .ast-line.group { color: var(--vscode-charts-blue); font-weight: bold; }
    .ast-line.repetition { color: var(--vscode-charts-orange); font-weight: bold; }
    .ast-line.set { color: var(--vscode-charts-purple); font-weight: bold; }
    .ast-line.char { color: var(--vscode-foreground); }
    .ast-line.position { color: var(--vscode-charts-green); font-weight: bold; }
    .ast-line.other { color: var(--vscode-foreground); }
    .ast-label {
        margin-right: 12px;
        min-width: 120px;
    }
    .ast-desc {
        color: var(--vscode-descriptionForeground);
        font-family: var(--vscode-font-family);
        font-size: 12px;
    }
    .apply-info {
        margin-top: 8px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
    }
    .railroad-container {
        margin-top: 8px;
        padding: 24px 20px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        background: var(--vscode-editor-background);
        overflow-x: auto;
        overflow-y: hidden;
        animation: rr-fade-in 0.35s ease-out;
    }
    @keyframes rr-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .railroad-container svg {
        background: transparent !important;
        max-width: none !important;
        display: block;
        margin: 0 auto;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.18));
    }
    .railroad-container svg text {
        text-anchor: middle !important;
        font: italic 12px monospace !important;
        fill: var(--vscode-foreground) !important;
        letter-spacing: normal !important;
        word-spacing: normal !important;
    }
    .railroad-container svg path {
        stroke: var(--vscode-descriptionForeground) !important;
        fill: none !important;
        stroke-width: 1.4 !important;
        stroke-linecap: round !important;
        stroke-linejoin: round !important;
    }
    .railroad-container svg g.rr-node > rect {
        fill: color-mix(in srgb, var(--vscode-textLink-foreground) 16%, transparent) !important;
        stroke: var(--vscode-textLink-foreground) !important;
        stroke-width: 1.4 !important;
    }
    .railroad-container svg g.rr-node--anchor > rect {
        fill: color-mix(in srgb, var(--vscode-charts-green) 22%, transparent) !important;
        stroke: var(--vscode-charts-green) !important;
    }
    .railroad-container svg g.rr-node--anchor > text {
        fill: var(--vscode-charts-green) !important;
    }
    .railroad-container svg g.rr-node--group > rect,
    .railroad-container svg g.rr-node--assertion > rect {
        fill: color-mix(in srgb, var(--vscode-charts-purple) 22%, transparent) !important;
        stroke: var(--vscode-charts-purple) !important;
    }
    .railroad-container svg g.rr-node--group > text,
    .railroad-container svg g.rr-node--assertion > text {
        fill: var(--vscode-charts-purple) !important;
    }
    .railroad-container svg g.rr-node--repeat path {
        stroke: var(--vscode-charts-orange) !important;
        stroke-width: 1.6 !important;
    }
    .railroad-container svg g.rr-node--charset > rect {
        fill: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-textLink-foreground)) 18%, transparent) !important;
        stroke: var(--vscode-charts-blue, var(--vscode-textLink-foreground)) !important;
    }
    .tests-toolbar {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
    }
    .tests-toolbar button { margin-top: 0; }
    .tests-list {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .test-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        border-left: 3px solid transparent;
    }
    .test-item.pass { border-left-color: var(--vscode-charts-green); }
    .test-item.fail { border-left-color: var(--vscode-editorError-foreground); }
    .test-item input[type="text"] {
        flex: 1;
        margin: 0;
        padding: 4px 8px;
        font-size: 13px;
    }
    .test-item label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        white-space: nowrap;
    }
    .test-item .test-result {
        font-size: 14px;
        font-weight: bold;
        min-width: 20px;
        text-align: center;
    }
    .test-item.pass .test-result { color: var(--vscode-charts-green); }
    .test-item.fail .test-result { color: var(--vscode-editorError-foreground); }
    .test-item .test-delete {
        background: transparent;
        color: var(--vscode-descriptionForeground);
        border: none;
        cursor: pointer;
        padding: 2px 6px;
        margin: 0;
        font-size: 14px;
        line-height: 1;
    }
    .test-item .test-delete:hover {
        color: var(--vscode-editorError-foreground);
    }
    .tests-summary {
        margin-top: 8px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
    }
    .tests-summary.all-pass { color: var(--vscode-charts-green); }
    .tests-summary.has-fail { color: var(--vscode-editorError-foreground); }
    .railroad-export-row {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
    }
    .railroad-export-row button {
        margin-top: 0;
        font-size: 12px;
        padding: 6px 12px;
    }
    .flags-row {
        display: flex;
        gap: 12px;
        margin-top: 8px;
        flex-wrap: wrap;
        font-size: 12px;
    }
    .flags-row label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        color: var(--vscode-descriptionForeground);
    }
    .flags-row label:hover {
        color: var(--vscode-foreground);
    }
    .flags-row input[type="checkbox"] {
        cursor: pointer;
        margin: 0;
    }
    .live-result {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 3px;
        background: var(--vscode-editor-background);
        font-family: var(--vscode-editor-font-family);
        font-size: 13px;
        white-space: pre-wrap;
        word-wrap: break-word;
        max-height: 300px;
        overflow-y: auto;
        line-height: 1.5;
    }
    .live-info {
        margin-top: 6px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
    }
    .dialect-row {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 8px;
    }
    .dialect-row label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        white-space: nowrap;
    }
    .dialect-row select {
        margin-top: 0;
        flex: 1;
    }
    .dialect-warning {
        margin-top: 8px;
        padding: 8px 12px;
        border-left: 3px solid var(--vscode-editorWarning-foreground);
        background: var(--vscode-inputValidation-warningBackground);
        border-radius: 3px;
        font-size: 13px;
    }
    .dialect-warning.error {
        border-left-color: var(--vscode-editorError-foreground);
        background: var(--vscode-inputValidation-errorBackground);
    }
    .dialect-warning.info {
        border-left-color: var(--vscode-charts-blue);
        background: var(--vscode-inputValidation-infoBackground);
    }
    .dialect-warning-title {
        font-weight: bold;
        margin-bottom: 4px;
    }
    .dialect-warning-hint {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
    }
</style>
</head>
<body>
    <h1>Ghost Regex <span class="badge ${pro ? 'pro' : 'free'}">${proBadge}</span></h1>

    <div class="tabs">
        <div class="tab active" data-tab="explain">Explain</div>
        <div class="tab" data-tab="preview">Preview</div>
        <div class="tab" data-tab="convert">Convert</div>
    </div>

    <div class="tab-content active" id="tab-explain">
        <input id="pattern" placeholder="Введите регулярное выражение..." />
        <div class="dialect-row">
            <label>Диалект:</label>
            <select id="dialect">
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="java">Java</option>
                <option value="pcre">PCRE</option>
            </select>
        </div>
        <div class="button-row">
            <button id="btn">Разобрать</button>
            <button id="btn-apply" class="secondary">Применить в редактор</button>
            <button id="btn-save" class="secondary">Сохранить</button>
        </div>
        <div class="apply-info" id="apply-info"></div>

        <div class="saved-patterns" id="saved-patterns-area"></div>

        <div class="section-title">Живой тест</div>
        <textarea id="live-text" placeholder="Введите текст для проверки..."></textarea>
        <div class="flags-row">
            <label><input type="checkbox" id="flag-g" checked> g (все)</label>
            <label><input type="checkbox" id="flag-i"> i (регистр)</label>
            <label><input type="checkbox" id="flag-m"> m (многостр.)</label>
            <label><input type="checkbox" id="flag-s"> s (dotall)</label>
            <label><input type="checkbox" id="flag-u"> u (unicode)</label>
        </div>
        <div class="live-result" id="live-result"><p class="empty">Введите regex и текст — совпадения подсветятся автоматически</p></div>
        <div class="live-info" id="live-info"></div>

        <div class="section-title">Unit-тесты</div>
        <div class="tests-toolbar">
            <button id="btn-test-add">+ Добавить тест</button>
            <button id="btn-test-run" class="secondary">Запустить все</button>
            <button id="btn-test-clear" class="secondary">Удалить все</button>
        </div>
        <div class="tests-list" id="tests-list"></div>
        <div class="tests-summary" id="tests-summary"></div>

        <div id="dialect-warnings-area"></div>

        <div class="snippets">
            <div class="snippets-title">Быстрые шаблоны (${snippets.length})</div>
            ${this._getSnippetsHtml()}
        </div>

        <div id="warnings-area"></div>
        <div id="railroad-area"></div>
        <div id="ast-area"></div>

        <div class="result" id="result">
            <p class="empty">Введите regex и нажмите «Разобрать»</p>
        </div>
    </div>

    <div class="tab-content" id="tab-preview">
        <input id="preview-pattern" placeholder="Regex для поиска в файле..." />
        <div class="button-row">
            <button id="btn-file">Выбрать файл</button>
            <button id="btn-highlight">Показать совпадения</button>
        </div>
        <p id="file-info" class="empty">Файл не выбран</p>
        <pre id="preview-content"></pre>
    </div>

    <div class="tab-content" id="tab-convert">
        <input id="convert-pattern" placeholder="Введите regex..." />
        <select id="convert-language">
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="java">Java</option>
        </select>
        <button id="btn-generate">Сгенерировать код</button>
        <div class="result">
            <p id="convert-info" class="empty">Введите regex, выберите язык и нажмите кнопку</p>
            <pre id="convert-output"></pre>
            <button id="btn-copy" style="display:none;">Копировать</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const isPro = ${pro};
        const tabs = document.querySelectorAll('.tab');
        const contents = document.querySelectorAll('.tab-content');

        let fileContent = '';
        let lastGeneratedCode = '';
        let tests = [];

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            });
        });

        const input = document.getElementById('pattern');
        const dialectSelect = document.getElementById('dialect');
        const btn = document.getElementById('btn');
        const btnApply = document.getElementById('btn-apply');
        const btnSave = document.getElementById('btn-save');
        const applyInfo = document.getElementById('apply-info');
        const result = document.getElementById('result');
        const warningsArea = document.getElementById('warnings-area');
        const astArea = document.getElementById('ast-area');
        const railroadArea = document.getElementById('railroad-area');
        const savedArea = document.getElementById('saved-patterns-area');
        const dialectWarningsArea = document.getElementById('dialect-warnings-area');

        const liveText = document.getElementById('live-text');
        const liveResult = document.getElementById('live-result');
        const liveInfo = document.getElementById('live-info');
        const MAX_MATCHES = 1000;

        function updateLive() {
            const pattern = input.value;
            const text = liveText.value;

            if (!pattern) {
                liveResult.innerHTML = '<p class="empty">Введите regex — совпадения подсветятся автоматически</p>';
                liveInfo.textContent = '';
                return;
            }
            if (!text) {
                liveResult.innerHTML = '<p class="empty">Введите текст для проверки</p>';
                liveInfo.textContent = '';
                return;
            }

            let flags = '';
            if (document.getElementById('flag-g').checked) flags += 'g';
            if (document.getElementById('flag-i').checked) flags += 'i';
            if (document.getElementById('flag-m').checked) flags += 'm';
            if (document.getElementById('flag-s').checked) flags += 's';
            if (document.getElementById('flag-u').checked) flags += 'u';

            try {
                const regex = new RegExp(pattern, flags);
                let html = '';
                let lastIndex = 0;
                let count = 0;

                if (!flags.includes('g')) {
                    const m = text.match(regex);
                    if (m && m.index !== undefined) {
                        html = escapeHtml(text.substring(0, m.index))
                            + '<mark>' + escapeHtml(m[0]) + '</mark>'
                            + escapeHtml(text.substring(m.index + m[0].length));
                        count = 1;
                    } else {
                        html = escapeHtml(text);
                    }
                } else {
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        if (match.index === regex.lastIndex) regex.lastIndex++;
                        html += escapeHtml(text.substring(lastIndex, match.index));
                        html += '<mark>' + escapeHtml(match[0]) + '</mark>';
                        lastIndex = regex.lastIndex;
                        count++;
                        if (count > MAX_MATCHES) break;
                    }
                    html += escapeHtml(text.substring(lastIndex));
                }

                liveResult.innerHTML = html;
                if (count === 0) {
                    liveInfo.textContent = 'Совпадений не найдено';
                } else if (count > MAX_MATCHES) {
                    liveInfo.textContent = 'Найдено: ' + count + '+ (показаны первые ' + MAX_MATCHES + ')';
                } else {
                    liveInfo.textContent = 'Найдено: ' + count;
                }
            } catch (e) {
                liveResult.innerHTML = '<p class="empty">Ошибка в regex: ' + escapeHtml(e.message) + '</p>';
                liveInfo.textContent = '';
            }
        }

        input.addEventListener('input', updateLive);
        liveText.addEventListener('input', updateLive);
        document.querySelectorAll('.flags-row input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateLive);
        });

        btn.addEventListener('click', () => {
            const pattern = input.value;
            if (pattern) {
                vscode.postMessage({
                    command: 'explain',
                    pattern,
                    dialect: dialectSelect.value
                });
            } else {
                warningsArea.innerHTML = '';
                astArea.innerHTML = '';
                railroadArea.innerHTML = '';
                dialectWarningsArea.innerHTML = '';
                result.innerHTML = '<p class="empty">Введите regex и нажмите «Разобрать»</p>';
            }
            updateLive();
        });

        dialectSelect.addEventListener('change', () => {
            if (input.value) {
                btn.click();
            }
        });

        btnApply.addEventListener('click', () => {
            const pattern = input.value;
            if (!pattern) {
                applyInfo.textContent = 'Введите regex для применения';
                return;
            }
            applyInfo.textContent = 'Применяю...';
            vscode.postMessage({ command: 'applyBack', pattern });
        });

        btnSave.addEventListener('click', () => {
            const pattern = input.value;
            if (!pattern) {
                applyInfo.textContent = 'Введите regex для сохранения';
                return;
            }
            vscode.postMessage({ command: 'saveCurrentPattern', pattern });
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { btn.click(); }
        });

        document.querySelectorAll('.snippet-btn').forEach(snipBtn => {
            snipBtn.addEventListener('click', () => {
                if (snipBtn.dataset.locked === 'true' && !isPro) {
                    vscode.postMessage({ command: 'buyPro' });
                    return;
                }
                input.value = snipBtn.dataset.pattern;
                btn.click();
            });
        });

        document.getElementById('btn-file').addEventListener('click', () => {
            if (!isPro) {
                vscode.postMessage({ command: 'buyPro' });
                return;
            }
            vscode.postMessage({ command: 'selectFile' });
        });

        document.getElementById('btn-highlight').addEventListener('click', () => {
            if (!isPro) {
                vscode.postMessage({ command: 'buyPro' });
                return;
            }
            const pattern = document.getElementById('preview-pattern').value;
            const contentEl = document.getElementById('preview-content');
            const infoEl = document.getElementById('file-info');

            if (!pattern) {
                infoEl.textContent = 'Введите regex для поиска';
                return;
            }
            if (!fileContent) {
                infoEl.textContent = 'Сначала выберите файл';
                return;
            }

            try {
                const regex = new RegExp(pattern, 'g');
                let html = '';
                let lastIndex = 0;
                let match;
                let count = 0;

                while ((match = regex.exec(fileContent)) !== null) {
                    if (match.index === regex.lastIndex) regex.lastIndex++;
                    html += escapeHtml(fileContent.substring(lastIndex, match.index));
                    html += '<mark>' + escapeHtml(match[0]) + '</mark>';
                    lastIndex = regex.lastIndex;
                    count++;
                    if (count > 10000) break;
                }
                html += escapeHtml(fileContent.substring(lastIndex));
                contentEl.innerHTML = html;
                infoEl.textContent = 'Совпадений: ' + count;
            } catch (e) {
                contentEl.textContent = 'Ошибка в regex: ' + e.message;
            }
        });

        document.getElementById('btn-generate').addEventListener('click', () => {
            const pattern = document.getElementById('convert-pattern').value;
            const language = document.getElementById('convert-language').value;
            const infoEl = document.getElementById('convert-info');

            if (!pattern) {
                infoEl.textContent = 'Введите regex';
                return;
            }

            if (!isPro && (language === 'go' || language === 'rust' || language === 'java')) {
                vscode.postMessage({ command: 'buyPro' });
                return;
            }

            vscode.postMessage({ command: 'generate', pattern, language });
        });

        document.getElementById('btn-copy').addEventListener('click', () => {
            if (lastGeneratedCode) {
                vscode.postMessage({ command: 'copyToClipboard', text: lastGeneratedCode });
            }
        });

        // === Unit-тесты ===

        function renderTests() {
            const list = document.getElementById('tests-list');
            if (tests.length === 0) {
                list.innerHTML = '<p class="empty">Нет тестов. Нажмите «+ Добавить тест».</p>';
                return;
            }
            let html = '';
            for (const t of tests) {
                const cls = t._result === 'pass' ? 'pass' : t._result === 'fail' ? 'fail' : '';
                const icon = t._result === 'pass' ? '✓' : t._result === 'fail' ? '✗' : '';
                const inputEsc = escapeAttr(t.input);
                html += '<div class="test-item ' + cls + '" data-id="' + t.id + '">';
                html += '<input type="text" class="test-input" value="' + inputEsc + '" placeholder="Строка для проверки..." />';
                html += '<label><input type="checkbox" class="test-expect"' + (t.expectMatch ? ' checked' : '') + ' /> должен совпасть</label>';
                html += '<span class="test-result">' + icon + '</span>';
                html += '<button class="test-delete" title="Удалить">✕</button>';
                html += '</div>';
            }
            list.innerHTML = html;

            list.querySelectorAll('.test-item').forEach(el => {
                const id = el.dataset.id;
                el.querySelector('.test-input').addEventListener('input', (e) => {
                    const t = tests.find(x => x.id === id);
                    if (!t) return;
                    t.input = e.target.value;
                    t._result = undefined;
                    updateTestVisual(id);
                    persistTests();
                });
                el.querySelector('.test-expect').addEventListener('change', (e) => {
                    const t = tests.find(x => x.id === id);
                    if (!t) return;
                    t.expectMatch = e.target.checked;
                    t._result = undefined;
                    updateTestVisual(id);
                    persistTests();
                });
                el.querySelector('.test-delete').addEventListener('click', () => {
                    tests = tests.filter(x => x.id !== id);
                    persistTests();
                    renderTests();
                });
            });
        }

        function updateTestVisual(id) {
            const el = document.querySelector('.test-item[data-id="' + id + '"]');
            if (!el) return;
            el.classList.remove('pass', 'fail');
            const icon = el.querySelector('.test-result');
            if (icon) icon.textContent = '';
        }

        function persistTests() {
            const clean = tests.map(t => ({ id: t.id, input: t.input, expectMatch: t.expectMatch }));
            vscode.postMessage({ command: 'saveTests', tests: clean });
        }

        function runAllTests() {
            const pattern = input.value;
            const summary = document.getElementById('tests-summary');

            if (!pattern) {
                summary.textContent = 'Введите regex в поле выше';
                summary.className = 'tests-summary';
                return;
            }
            let regex;
            try {
                regex = new RegExp(pattern);
            } catch (e) {
                summary.textContent = 'Ошибка в regex: ' + e.message;
                summary.className = 'tests-summary has-fail';
                return;
            }
            if (tests.length === 0) {
                summary.textContent = 'Нет тестов для запуска';
                summary.className = 'tests-summary';
                return;
            }

            let passed = 0;
            let failed = 0;
            for (const t of tests) {
                const matched = regex.test(t.input);
                if (matched === t.expectMatch) { t._result = 'pass'; passed++; }
                else { t._result = 'fail'; failed++; }
            }
            renderTests();

            summary.textContent = 'Пройдено: ' + passed + ' / ' + tests.length
                + (failed > 0 ? ' — провалено: ' + failed : '');
            summary.className = 'tests-summary ' + (failed === 0 ? 'all-pass' : 'has-fail');
        }

        document.getElementById('btn-test-add').addEventListener('click', () => {
            tests.push({
                id: 'test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                input: '',
                expectMatch: true
            });
            persistTests();
            renderTests();
        });

        document.getElementById('btn-test-run').addEventListener('click', runAllTests);

        document.getElementById('btn-test-clear').addEventListener('click', () => {
            if (tests.length === 0) return;
            tests = [];
            persistTests();
            renderTests();
            const summary = document.getElementById('tests-summary');
            summary.textContent = '';
            summary.className = 'tests-summary';
        });

        // === Экспорт диаграммы в SVG ===

        function exportRailroad() {
            const svg = document.querySelector('.railroad-container svg');
            if (!svg) return;

            const clone = svg.cloneNode(true);
            const origs = svg.querySelectorAll('*');
            const clones = clone.querySelectorAll('*');
            for (let i = 0; i < origs.length; i++) {
                const computed = getComputedStyle(origs[i]);
                const c = clones[i];
                const tag = c.tagName.toLowerCase();
                if (tag === 'text') {
                    c.setAttribute('fill', computed.fill);
                    c.setAttribute('font-family', computed.fontFamily);
                    c.setAttribute('font-size', computed.fontSize);
                    c.setAttribute('font-style', computed.fontStyle);
                    c.setAttribute('text-anchor', computed.textAnchor);
                } else if (tag === 'rect') {
                    c.setAttribute('fill', computed.fill);
                    c.setAttribute('stroke', computed.stroke);
                    c.setAttribute('stroke-width', computed.strokeWidth);
                } else if (tag === 'path') {
                    c.setAttribute('fill', computed.fill);
                    c.setAttribute('stroke', computed.stroke);
                    c.setAttribute('stroke-width', computed.strokeWidth);
                }
            }
            clone.setAttribute('style', 'background:#1e1e1e;padding:16px');
            const svgString = clone.outerHTML;

            vscode.postMessage({ command: 'exportRailroad', svg: svgString });
        }

        window.addEventListener('message', (event) => {
            const msg = event.data;

            if (msg.command === 'setPattern') {
                input.value = msg.pattern;
                applyInfo.textContent = 'Готово к замене в редакторе';
                btn.click();
            }

            if (msg.command === 'applyBackResult') {
                if (msg.success) {
                    applyInfo.textContent = '✓ Regex заменён в редакторе';
                } else {
                    applyInfo.textContent = '✗ ' + msg.error;
                }
            }

            if (msg.command === 'savedPatterns') {
                renderSavedPatterns(msg.patterns || []);
            }

            if (msg.command === 'loadedTests') {
                tests = (msg.tests || []).map(t => ({ ...t, _result: undefined }));
                renderTests();
            }

            if (msg.command === 'result') {
                warningsArea.innerHTML = '';
                astArea.innerHTML = '';
                railroadArea.innerHTML = '';
                dialectWarningsArea.innerHTML = '';

                if (msg.dialectWarnings && msg.dialectWarnings.length > 0) {
                    let html = '<div class="section-title">Совместимость с диалектами</div>';
                    for (const w of msg.dialectWarnings) {
                        const cls = w.severity === 'error' ? 'dialect-warning error'
                            : w.severity === 'info' ? 'dialect-warning info'
                            : 'dialect-warning';
                        const icon = w.severity === 'error' ? '❌'
                            : w.severity === 'info' ? 'ℹ️'
                            : '⚠️';
                        html += '<div class="' + cls + '">';
                        html += '<div class="dialect-warning-title">' + icon + ' ' + escapeHtml(w.message) + '</div>';
                        if (w.hint) {
                            html += '<div class="dialect-warning-hint">' + escapeHtml(w.hint) + '</div>';
                        }
                        html += '</div>';
                    }
                    dialectWarningsArea.innerHTML = html;
                }

                if (msg.warnings && msg.warnings.length > 0) {
                    for (const w of msg.warnings) {
                        const cls = w.severity === 'danger' ? 'redos-warning danger' : 'redos-warning';
                        const icon = w.severity === 'danger' ? '🚨' : '⚠️';
                        let html = '<div class="' + cls + '">';
                        html += '<div class="redos-title"><span class="redos-icon">' + icon + '</span>' + escapeHtml(w.message) + '</div>';
                        html += '<div class="redos-hint">' + escapeHtml(w.hint) + '</div>';
                        if (w.fix) {
                            html += '<div class="redos-fix">✅ Исправление: <code>' + escapeHtml(w.fix) + '</code></div>';
                        }
                        html += '</div>';
                        warningsArea.innerHTML += html;
                    }
                }

                if (msg.railroadSvg) {
                    let html = '<div class="section-title">Диаграмма</div>';
                    html += '<div class="railroad-container">';
                    html += msg.railroadSvg;
                    html += '</div>';
                    html += '<div class="railroad-export-row">';
                    html += '<button id="btn-export-svg" class="secondary">Скачать SVG</button>';
                    html += '</div>';
                    railroadArea.innerHTML = html;

                    const exportBtn = document.getElementById('btn-export-svg');
                    if (exportBtn) {
                        exportBtn.addEventListener('click', exportRailroad);
                    }
                }

                if (msg.ast && msg.ast.length > 0) {
                    let html = '<div class="section-title">Структура (AST)</div>';
                    html += '<div class="ast-tree">';
                    for (const line of msg.ast) {
                        const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(line.depth);
                        html += '<div class="ast-line ' + line.type + '">';
                        html += '<span class="ast-label">' + indent + escapeHtml(line.label) + '</span>';
                        html += '<span class="ast-desc">' + escapeHtml(line.description) + '</span>';
                        html += '</div>';
                    }
                    html += '</div>';
                    astArea.innerHTML = html;
                }

                if (msg.tokens.length === 0) {
                    result.innerHTML = '<p class="empty">Пустой шаблон</p>';
                    return;
                }
                let html = '<div class="section-title">Токены</div>';
                for (const t of msg.tokens) {
                    html += '<div class="token">';
                    html += '<span class="token-raw">' + escapeHtml(t.raw) + '</span>';
                    html += '<span class="token-desc">' + escapeHtml(t.description) + '</span>';
                    html += '</div>';
                }
                result.innerHTML = html;
            }

            if (msg.command === 'fileContent') {
                fileContent = msg.content;
                const infoEl = document.getElementById('file-info');
                const name = msg.fileName.split(/[\\\\/]/).pop();
                infoEl.textContent = 'Файл: ' + name + (msg.truncated ? ' (обрезан до 50000 символов)' : '');
                document.getElementById('preview-content').textContent = fileContent;
            }

            if (msg.command === 'fileError') {
                document.getElementById('file-info').textContent = 'Ошибка: ' + msg.error;
            }

            if (msg.command === 'generatedCode') {
                lastGeneratedCode = msg.code;
                document.getElementById('convert-info').textContent = 'Язык: ' + msg.language;
                document.getElementById('convert-output').textContent = msg.code;
                document.getElementById('btn-copy').style.display = 'inline-block';
            }
        });

        function renderSavedPatterns(patterns) {
            if (!patterns || patterns.length === 0) {
                savedArea.innerHTML = '';
                return;
            }
            let html = '<div class="saved-patterns-title">Мои паттерны (' + patterns.length + ')</div>';
            for (const p of patterns) {
                const escaped = escapeAttr(p.pattern);
                const nameEsc = escapeHtml(p.name);
                html += '<div class="saved-pattern-item">';
                html += '<span class="saved-pattern-name" data-pattern="' + escaped + '" title="' + escaped + '">' + nameEsc + '</span>';
                html += '<button class="saved-pattern-delete" data-pattern="' + escaped + '" title="Удалить">✕</button>';
                html += '</div>';
            }
            savedArea.innerHTML = html;

            savedArea.querySelectorAll('.saved-pattern-name').forEach(el => {
                el.addEventListener('click', () => {
                    input.value = el.dataset.pattern;
                    btn.click();
                });
            });
            savedArea.querySelectorAll('.saved-pattern-delete').forEach(el => {
                el.addEventListener('click', () => {
                    vscode.postMessage({ command: 'deleteSavedPattern', pattern: el.dataset.pattern });
                });
            });
        }

        function escapeHtml(s) {
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        function escapeAttr(s) {
            return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        vscode.postMessage({ command: 'requestPatterns' });
        vscode.postMessage({ command: 'requestTests' });
        updateLive();
    </script>
</body>
</html>`;
    }
}