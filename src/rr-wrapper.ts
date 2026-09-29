// @ts-ignore
import * as railroad from 'railroad-diagrams';

// Библиотека railroad-diagrams использует module-pattern, поэтому
// напрямую классы через import нельзя — берём из namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RailTerminal: any = (railroad as any).Terminal;

export type SemanticKind =
    | 'literal'
    | 'charset'
    | 'anchor'
    | 'group'
    | 'assertion'
    | 'repeat';

export interface TerminalMeta {
    kind: SemanticKind;
    title?: string;
}

/**
 * Обёртка над railroad.Terminal: добавляет CSS-класс на обёртку <g>
 * (rr-node rr-node--<kind>), а если задан title — вставляет <title>
 * сразу после открывающего тега <g>. Это даёт тултип при hover
 * и позволяет красить разные типы узлов по-разному.
 */
export function makeTerminal(text: string, meta: TerminalMeta): unknown {
    const t: any = new RailTerminal(text);

    t.attrs = t.attrs || {};
    const cls = 'rr-node rr-node--' + meta.kind;
    t.attrs.class = t.attrs.class ? t.attrs.class + ' ' + cls : cls;

    if (meta.title) {
        const safeTitle = meta.title
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const origToString = t.toString.bind(t);
        t.toString = () => {
            const s: string = origToString();
            return s.replace(/^(<g[^>]*>)/, `$1<title>${safeTitle}</title>`);
        };
    }

    return t;
}

/**
 * Хелперы для типовых подписей-тултипов.
 */
export const positionTitle = (value: string): string => {
    if (value === '^') return 'Начало строки';
    if (value === '$') return 'Конец строки';
    if (value === 'b') return 'Граница слова';
    if (value === 'B') return 'Не граница слова';
    return 'Позиция';
};

export const charsetTitle = (negated: boolean): string =>
    negated ? 'Набор символов (отрицание)' : 'Набор символов';

export const repetitionTitle = (label: string): string => {
    if (label.startsWith('×')) return 'Ровно ' + label.slice(1) + ' раз';
    if (label.endsWith('+')) return label.slice(0, -1) + ' или более раз';
    return 'Повтор ' + label;
};
/**
 * Обёртка для граф-узлов повторения (OneOrMore/ZeroOrMore/Optional).
 * Не терминал — у него нет своего rect, но он оборачивает один.
 * Навешивает класс rr-node--repeat на <g>, чтобы CSS красил
 * всё содержимое петли (и вложенный терминал) в оранжевый.
 */
export function makeRepeat<T extends { attrs?: Record<string, string> }>(
    node: T,
    title?: string
): T {
    node.attrs = node.attrs || {};
    const cls = 'rr-node rr-node--repeat';
    node.attrs.class = node.attrs.class ? node.attrs.class + ' ' + cls : cls;

    if (title) {
        const safeTitle = title
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const anyNode: any = node;
        const origToString = anyNode.toString.bind(anyNode);
        anyNode.toString = () => {
            const s: string = origToString();
            return s.replace(/^(<g[^>]*>)/, `$1<title>${safeTitle}</title>`);
        };
    }

    return node;
}