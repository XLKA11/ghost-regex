import * as vscode from 'vscode';

const LICENSE_KEY = 'ghostRegex.licenseKey';
const PRO_KEY_STORAGE = 'ghostRegex.isPro';
const LICENSE_URL = 'https://gumroad.com/ghost-regex'; // поменяем потом

/**
 * Проверка формата ключа.
 * Формат: GHOST-XXXX-XXXX-XXXX
 * X — заглавная буква или цифра.
 */
export function isValidKeyFormat(key: string): boolean {
    return /^GHOST-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key.trim().toUpperCase());
}

/**
 * Локальная проверка контрольной суммы ключа.
 * Пока без сервера: считаем сумму символов и проверяем делимость.
 * В будущем заменим на проверку через API Gumroad.
 */
export function passesChecksum(key: string): boolean {
    const clean = key.trim().toUpperCase().replace(/-/g, '');
    let sum = 0;
    for (const ch of clean) {
        sum += ch.charCodeAt(0);
    }
    return sum % 7 === 0;
}

/**
 * Возвращает true, если у пользователя активирован Pro.
 */
export function isPro(context: vscode.ExtensionContext): boolean {
    return context.globalState.get<boolean>(PRO_KEY_STORAGE, false);
}

/**
 * Возвращает сохранённый ключ (или undefined).
 */
export function getSavedKey(context: vscode.ExtensionContext): string | undefined {
    return context.globalState.get<string>(LICENSE_KEY);
}

/**
 * Сохраняет ключ и активирует Pro, если ключ валидный.
 * Возвращает true, если активация прошла.
 */
export async function activateLicense(
    context: vscode.ExtensionContext,
    key: string
): Promise<boolean> {
    const trimmed = key.trim().toUpperCase();

    if (!isValidKeyFormat(trimmed)) {
        return false;
    }

    if (!passesChecksum(trimmed)) {
        return false;
    }

    await context.globalState.update(LICENSE_KEY, trimmed);
    await context.globalState.update(PRO_KEY_STORAGE, true);
    return true;
}

/**
 * Убирает ключ и отключает Pro.
 */
export async function deactivateLicense(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(LICENSE_KEY, undefined);
    await context.globalState.update(PRO_KEY_STORAGE, false);
}

/**
 * Возвращает ссылку на страницу покупки.
 */
export function getPurchaseUrl(): string {
    return LICENSE_URL;
}