import * as vscode from 'vscode';
import { GhostRegexPanel } from './panel';
import {
    activateLicense,
    deactivateLicense,
    getPurchaseUrl,
    getSavedKey,
    isPro
} from './license';

export function activate(context: vscode.ExtensionContext) {
    console.log('Ghost-Regex активен');

    // Основная команда — открыть панель
    const explainCmd = vscode.commands.registerCommand('ghost-regex.explain', () => {
        GhostRegexPanel.createOrShow(context);
    });

    // Объяснить выделенное + запомнить позицию для Sync Back
    const explainSelectionCmd = vscode.commands.registerCommand('ghost-regex.explainSelection', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Откройте файл и выделите regex');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Сначала выделите regex в коде');
            return;
        }
        const text = editor.document.getText(selection).trim();
        if (!text) {
            vscode.window.showWarningMessage('Выделение пустое');
            return;
        }

        // Запоминаем контекст для Sync Back
        GhostRegexPanel.setSyncBackContext(editor.document.uri, selection);
        GhostRegexPanel.createOrShowWithPattern(context, text);
    });

    // Применить обратно в редактор
    const applyBackCmd = vscode.commands.registerCommand('ghost-regex.applyBack', async (newPattern: string) => {
        if (!newPattern) {
            vscode.window.showWarningMessage('Нет regex для применения');
            return;
        }
        const ctx = GhostRegexPanel.getSyncBackContext();
        if (!ctx) {
            vscode.window.showWarningMessage('Сначала выделите regex в коде через "Объяснить выделенное"');
            return;
        }

        const document = await vscode.workspace.openTextDocument(ctx.uri);
        const editor = await vscode.window.showTextDocument(document);
        const ok = await editor.edit((editBuilder) => {
            editBuilder.replace(ctx.selection, newPattern);
        });

        if (ok) {
            vscode.window.showInformationMessage('Regex заменён в редакторе');
            GhostRegexPanel.clearSyncBackContext();
        } else {
            vscode.window.showErrorMessage('Не удалось заменить regex');
        }
    });

    // Ввести лицензию
    const licenseCmd = vscode.commands.registerCommand('ghost-regex.enterLicense', async () => {
        const key = await vscode.window.showInputBox({
            prompt: 'Введите лицензионный ключ',
            placeHolder: 'GHOST-XXXX-XXXX-XXXX',
            ignoreFocusOut: true
        });

        if (!key) {
            return;
        }

        const ok = await activateLicense(context, key);
        if (ok) {
            vscode.window.showInformationMessage('Лицензия активирована. Pro-функции разблокированы.');
            GhostRegexPanel.refresh(context);
        } else {
            const action = await vscode.window.showErrorMessage(
                'Неверный формат ключа. Проверьте и попробуйте снова.',
                'Купить Pro'
            );
            if (action === 'Купить Pro') {
                vscode.env.openExternal(vscode.Uri.parse(getPurchaseUrl()));
            }
        }
    });

    // Показать статус
    const statusCmd = vscode.commands.registerCommand('ghost-regex.showStatus', () => {
        const pro = isPro(context);
        const key = getSavedKey(context);

        if (pro && key) {
            vscode.window.showInformationMessage(
                `Ghost Regex: Pro активирован. Ключ: ${key}`
            );
        } else {
            vscode.window.showInformationMessage(
                'Ghost Regex: Free версия. Купите Pro за $5/мес для разблокировки Preview, всех сниппетов и Convert для Go/Rust/Java.'
            );
        }
    });

    // Деактивировать
    const deactivateCmd = vscode.commands.registerCommand('ghost-regex.deactivateLicense', async () => {
        const confirm = await vscode.window.showWarningMessage(
            'Деактивировать лицензию? Pro-функции станут недоступны.',
            { modal: true },
            'Деактивировать'
        );
        if (confirm === 'Деактивировать') {
            await deactivateLicense(context);
            vscode.window.showInformationMessage('Лицензия деактивирована.');
            GhostRegexPanel.refresh(context);
        }
    });

    context.subscriptions.push(explainCmd, explainSelectionCmd, applyBackCmd, licenseCmd, statusCmd, deactivateCmd);
}

export function deactivate() {}