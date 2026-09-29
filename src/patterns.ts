import * as vscode from 'vscode';

const STORAGE_KEY = 'ghostRegex.savedPatterns';
const MAX_PATTERNS = 50;

export interface SavedPattern {
    pattern: string;
    name: string;
    createdAt: number;
}

export function loadPatterns(context: vscode.ExtensionContext): SavedPattern[] {
    const raw = context.globalState.get<SavedPattern[]>(STORAGE_KEY, []);
    return raw.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePattern(
    context: vscode.ExtensionContext,
    pattern: string,
    name?: string
): Promise<boolean> {
    if (!pattern || pattern.length === 0) {
        return false;
    }
    const trimmed = pattern.trim();
    const patterns = loadPatterns(context);

    // Проверка на дубликат
    if (patterns.some(p => p.pattern === trimmed)) {
        return false;
    }

    const displayName = name && name.trim().length > 0 ? name.trim() : generateName(trimmed);

    patterns.push({
        pattern: trimmed,
        name: displayName,
        createdAt: Date.now()
    });

    // Обрезаем до MAX_PATTERNS
    while (patterns.length > MAX_PATTERNS) {
        patterns.pop();
    }

    await context.globalState.update(STORAGE_KEY, patterns);
    return true;
}

export async function deletePattern(
    context: vscode.ExtensionContext,
    pattern: string
): Promise<boolean> {
    const patterns = loadPatterns(context);
    const filtered = patterns.filter(p => p.pattern !== pattern);
    if (filtered.length === patterns.length) {
        return false;
    }
    await context.globalState.update(STORAGE_KEY, filtered);
    return true;
}

export async function clearAllPatterns(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(STORAGE_KEY, []);
}

function generateName(pattern: string): string {
    // Если паттерн короткий — используем как есть
    if (pattern.length <= 30) {
        return pattern;
    }
    // Иначе — обрезаем
    return pattern.substring(0, 27) + '...';
}