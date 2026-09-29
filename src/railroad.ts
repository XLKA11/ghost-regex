// @ts-ignore
import * as railroad from 'railroad-diagrams';
// @ts-ignore
import { parse } from 'regex-inspector';
import { makeTerminal, makeRepeat, positionTitle, charsetTitle, repetitionTitle } from './rr-wrapper';

interface AnyNode {
    kind: string;
    [key: string]: any;
}

export function buildRailroad(pattern: string): string | null {
    if (!pattern || pattern.length === 0) {
        return null;
    }

    let ast: AnyNode;
    try {
        ast = parse(pattern) as AnyNode;
    } catch (e) {
        return null;
    }

    try {
        const inner = toRailroad(ast);
        const diagram = railroad.Diagram(inner);
        return diagram.toString();
    } catch (e) {
        return null;
    }
}

function toRailroad(node: AnyNode): any {
    switch (node.kind) {
        case 'root':
            return rootToRailroad(node);
        case 'group':
            return groupToRailroad(node);
        case 'repetition':
            return repetitionToRailroad(node);
        case 'charset':
            return charsetToRailroad(node);
        case 'char':
            return makeTerminal(charToText(node.value), {
                kind: 'literal',
                title: 'Символ: ' + charToText(node.value)
            });
        case 'position':
            return makeTerminal(positionToText(node.value), {
                kind: 'anchor',
                title: positionTitle(node.value)
            });
        case 'backreference':
            return makeTerminal('\\' + node.index, {
                kind: 'literal',
                title: 'Обратная ссылка на группу #' + node.index
            });
        case 'unicode_property':
            return makeTerminal('\\' + (node.negated ? 'P' : 'p') + '{' + node.property + '}', {
                kind: 'charset',
                title: 'Unicode-свойство: ' + node.property
            });
        default:
            return makeTerminal('?', { kind: 'literal' });
    }
}

function rootToRailroad(node: AnyNode): any {
    const branches: AnyNode[][] = node.branches || [];

    if (branches.length === 1) {
        return sequenceOrSingle(branches[0]);
    }

    const alternatives = branches.map(branch => sequenceOrSingle(branch));
    return railroad.Choice(0, ...alternatives);
}

function groupToRailroad(node: AnyNode): any {
    const branches: AnyNode[][] = node.branches || [];

    let inner: any;
    if (branches.length === 1) {
        inner = sequenceOrSingle(branches[0]);
    } else {
        const alternatives = branches.map(branch => sequenceOrSingle(branch));
        inner = railroad.Choice(0, ...alternatives);
    }

    let prefix = '';
    let suffix = '';
    let kind: 'group' | 'assertion' = 'group';
    let titlePrefix = 'Группа';
    let titleSuffix = 'Группа';

    if (node.lookahead) {
        prefix = '(?='; suffix = ')';
        kind = 'assertion'; titlePrefix = 'Начало позитивного просмотра вперёд';
        titleSuffix = 'Конец просмотра';
    } else if (node.negatedLookahead) {
        prefix = '(?!'; suffix = ')';
        kind = 'assertion'; titlePrefix = 'Начало негативного просмотра вперёд';
        titleSuffix = 'Конец просмотра';
    } else if (node.lookbehind) {
        prefix = '(?<='; suffix = ')';
        kind = 'assertion'; titlePrefix = 'Начало позитивного просмотра назад';
        titleSuffix = 'Конец просмотра';
    } else if (node.negatedLookbehind) {
        prefix = '(?<!'; suffix = ')';
        kind = 'assertion'; titlePrefix = 'Начало негативного просмотра назад';
        titleSuffix = 'Конец просмотра';
    } else if (node.name) {
        prefix = '(?<' + node.name + '>'; suffix = ')';
        titlePrefix = 'Именованная группа «' + node.name + '»';
        titleSuffix = 'Конец группы';
    } else if (node.capturing) {
        prefix = '('; suffix = ')';
        titlePrefix = 'Группа захвата'; titleSuffix = 'Конец группы';
    } else {
        prefix = '(?:'; suffix = ')';
        titlePrefix = 'Группа без захвата'; titleSuffix = 'Конец группы';
    }

    return new railroad.Sequence([
        makeTerminal(prefix, { kind, title: titlePrefix }),
        inner,
        makeTerminal(suffix, { kind, title: titleSuffix })
    ]);
}

function repetitionToRailroad(node: AnyNode): any {
    const inner = toRailroad(node.child);
    const min = node.min;
    const max = node.max;

    if (min === 0 && max === Infinity) {
        return makeRepeat(
            new railroad.ZeroOrMore(inner),
            'Повтор 0 или более раз'
        );
    }
    if (min === 1 && max === Infinity) {
        return makeRepeat(
            new railroad.OneOrMore(inner),
            'Повтор 1 или более раз'
        );
    }
    if (min === 0 && max === 1) {
        return makeRepeat(
            new railroad.Optional(inner),
            'Опционально (0 или 1 раз)'
        );
    }

    let label = '';
    if (min === max) {
        label = `×${min}`;
    } else if (max === Infinity) {
        label = `${min}+`;
    } else {
        label = `${min}..${max}`;
    }

    return new railroad.Sequence([
        inner,
        makeTerminal(label, { kind: 'repeat', title: repetitionTitle(label) })
    ]);
}

function charsetToRailroad(node: AnyNode): any {
    const members: AnyNode[] = node.members || [];
    const negated = node.negated;

    let inner = '';
    for (const m of members) {
        if (m.kind === 'char') {
            inner += charToText(m.value);
        } else if (m.kind === 'range') {
            inner += charToText(m.from) + '-' + charToText(m.to);
        } else if (m.kind === 'charset') {
            inner += '[вложенный]';
        } else if (m.kind === 'unicode_property') {
            inner += '\\' + (m.negated ? 'P' : 'p') + '{' + m.property + '}';
        }
    }

    const text = (negated ? '[^' : '[') + inner + ']';
    return makeTerminal(text, { kind: 'charset', title: charsetTitle(!!negated) });
}

function sequenceOrSingle(branch: AnyNode[]): any {
    if (branch.length === 0) {
        return makeTerminal('', { kind: 'literal' });
    }
    if (branch.length === 1) {
        return toRailroad(branch[0]);
    }
    const items = branch.map(token => toRailroad(token));
    return new railroad.Sequence(items);
}

function charToText(value: number): string {
    const ch = String.fromCodePoint(value);
    if (ch === '\n') return '\\n';
    if (ch === '\t') return '\\t';
    if (ch === '\r') return '\\r';
    if (ch === ' ') return '␣';
    return ch;
}

function positionToText(value: string): string {
    if (value === '^') return '^';
    if (value === '$') return '$';
    if (value === 'b') return '\\b';
    if (value === 'B') return '\\B';
    return value;
}