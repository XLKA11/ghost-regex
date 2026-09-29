import * as vscode from 'vscode';

const STORAGE_KEY = 'ghostRegex.regexTests';

export interface RegexTest {
    id: string;
    input: string;
    expectMatch: boolean;
}

export function loadTests(context: vscode.ExtensionContext): RegexTest[] {
    return context.globalState.get<RegexTest[]>(STORAGE_KEY, []);
}

export async function saveTests(
    context: vscode.ExtensionContext,
    tests: RegexTest[]
): Promise<void> {
    await context.globalState.update(STORAGE_KEY, tests);
}