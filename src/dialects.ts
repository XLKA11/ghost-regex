export type Dialect = 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'pcre';

export interface DialectWarning {
    severity: 'error' | 'warning' | 'info';
    message: string;
    hint?: string;
}

const DIALECT_NAMES: Record<Dialect, string> = {
    javascript: 'JavaScript',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    pcre: 'PCRE'
};

export function checkDialect(pattern: string, dialect: Dialect): DialectWarning[] {
    const warnings: DialectWarning[] = [];
    if (!pattern) {
        return warnings;
    }

    // (?P<name>...) — Python-стиль
    if (/\(\?P<[^>]+>/.test(pattern)) {
        if (dialect !== 'python') {
            warnings.push({
                severity: 'error',
                message: `(?P<name>...) не поддерживается в ${DIALECT_NAMES[dialect]}`,
                hint: 'Используйте (?<name>...) — этот синтаксис работает в Python 3, JavaScript, Java'
            });
        }
    }

    // (?<name>...) — современный синтаксис
    if (/\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/.test(pattern)) {
        if (dialect === 'go') {
            warnings.push({
                severity: 'error',
                message: 'Именованные группы (?<name>...) не поддерживаются в Go до версии 1.22',
                hint: 'В старых версиях Go используйте обычные группы (...) с нумерацией'
            });
        }
    }

    // Lookbehind (?<=...) и (?<!...)
    if (/\(\?<[=!]/.test(pattern)) {
        if (dialect === 'javascript') {
            warnings.push({
                severity: 'info',
                message: 'Lookbehind (?<=...) поддерживается в современных движках JavaScript',
                hint: 'Работает в V8 (Chrome 62+, Node 8.3+), SpiderMonkey (Firefox 78+), JavaScriptCore (Safari 16.4+)'
            });
        }
        if (dialect === 'go') {
            warnings.push({
                severity: 'error',
                message: 'Lookbehind (?<=...) не поддерживается в Go до версии 1.20',
                hint: 'В Go 1.20+ поддерживается только lookbehind с фиксированной длиной'
            });
        }
    }

    // Атомарные группы (?>...)
    if (/\(\?>/.test(pattern)) {
        if (dialect === 'javascript') {
            warnings.push({
                severity: 'error',
                message: 'Атомарные группы (?>...) не поддерживаются в JavaScript',
                hint: 'Работают в PCRE, Java, .NET. В JS можно эмулировать через lookahead'
            });
        }
        if (dialect === 'python') {
            warnings.push({
                severity: 'warning',
                message: 'Атомарные группы (?>...) поддерживаются в Python только с версии 3.11',
                hint: 'Для старых версий Python — эмуляция через lookahead'
            });
        }
        if (dialect === 'go' || dialect === 'rust') {
            warnings.push({
                severity: 'error',
                message: `Атомарные группы (?>...) не поддерживаются в ${DIALECT_NAMES[dialect]}`,
                hint: 'Используйте обычные группы'
            });
        }
    }

    // Условные группы (?(...)
    if (/\(\?\(/.test(pattern)) {
        if (dialect === 'javascript' || dialect === 'go' || dialect === 'rust') {
            warnings.push({
                severity: 'error',
                message: `Условные группы (?(...) не поддерживаются в ${DIALECT_NAMES[dialect]}`,
                hint: 'Поддерживаются только в PCRE, Python и .NET'
            });
        }
    }

    // \A, \Z, \z — анкоры PCRE
    if (/\\[AZz]/.test(pattern)) {
        if (dialect === 'javascript' || dialect === 'go' || dialect === 'rust' || dialect === 'java') {
            warnings.push({
                severity: 'warning',
                message: `\\A, \\Z, \\z не поддерживаются в ${DIALECT_NAMES[dialect]}`,
                hint: 'Используйте ^ и $ вместо них'
            });
        }
    }

    // \K — reset match start (PCRE)
    if (/\\K/.test(pattern)) {
        if (dialect !== 'pcre') {
            warnings.push({
                severity: 'error',
                message: `\\K не поддерживается в ${DIALECT_NAMES[dialect]}`,
                hint: 'Работает только в PCRE (Perl-совместимые движки)'
            });
        }
    }

    // Рекурсия (?R) и (?1)
    if (/\(\?R\)|\(\?\d+\)/.test(pattern)) {
        if (dialect !== 'pcre') {
            warnings.push({
                severity: 'error',
                message: `Рекурсия (?R), (?1) не поддерживается в ${DIALECT_NAMES[dialect]}`,
                hint: 'Работает только в PCRE и Perl'
            });
        }
    }

    // Инлайн-модификаторы (?i), (?m), (?s)
    if (/\(\?[imsx-]+\)/.test(pattern)) {
        if (dialect === 'javascript') {
            warnings.push({
                severity: 'error',
                message: 'Инлайн-модификаторы (?i) не поддерживаются в JavaScript',
                hint: 'В JS флаги передаются вне regex: /pattern/i'
            });
        }
        if (dialect === 'go') {
            warnings.push({
                severity: 'info',
                message: 'В Go поддерживается только (?i) в начале паттерна',
                hint: 'Остальные модификаторы — через API regexp'
            });
        }
    }

    // \d, \w, \s — Unicode vs ASCII
    if (/\\[dws]/.test(pattern)) {
        if (dialect === 'javascript') {
            warnings.push({
                severity: 'info',
                message: '\\d, \\w, \\s работают с Unicode только с флагом /u',
                hint: 'Без /u они матчат только ASCII-символы'
            });
        }
    }

    return warnings;
}

export function getDialectName(dialect: Dialect): string {
    return DIALECT_NAMES[dialect];
}