// @ts-ignore
import { parse } from 'regex-inspector';

export interface AstLine {
    depth: number;
    label: string;
    description: string;
    type: 'root' | 'group' | 'repetition' | 'char' | 'set' | 'position' | 'other';
}

interface AnyNode {
    kind: string;
    [key: string]: any;
}

export function buildAstTree(pattern: string): AstLine[] {
    let ast: AnyNode;
    try {
        ast = parse(pattern) as AnyNode;
       } catch (e) {
        return [];
    }

    const lines: AstLine[] = [];
    walkNode(ast, 0, lines);
    return lines;
}

function walkNode(node: AnyNode, depth: number, lines: AstLine[]): void {
    if (!node || typeof node !== 'object') {
        return;
    }

    switch (node.kind) {
        case 'root':
            walkRoot(node, depth, lines);
            break;
        case 'group':
            walkGroup(node, depth, lines);
            break;
        case 'repetition':
            walkRepetition(node, depth, lines);
            break;
        case 'charset':
            walkCharSet(node, depth, lines);
            break;
        case 'char':
            lines.push({
                depth,
                label: `"${String.fromCodePoint(node.value)}"`,
                description: `символ (U+${node.value.toString(16).toUpperCase().padStart(4, '0')})`,
                type: 'char'
            });
            break;
        case 'position':
            lines.push({
                depth,
                label: node.value === 'b' ? '\\b' : node.value === 'B' ? '\\B' : node.value,
                description: positionDescription(node.value),
                type: 'position'
            });
            break;
        case 'unicode_property':
            lines.push({
                depth,
                label: (node.negated ? '\\P{' : '\\p{') + node.property + '}',
                description: `Unicode-свойство: ${node.property}` + (node.negated ? ' (отрицание)' : ''),
                type: 'other'
            });
            break;
        case 'backreference':
            lines.push({
                depth,
                label: `\\${node.index}`,
                description: `обратная ссылка на группу #${node.index}`,
                type: 'other'
            });
            break;
        default:
            lines.push({
                depth,
                label: node.kind || '?',
                description: 'неизвестный узел',
                type: 'other'
            });
    }
}

function walkRoot(node: AnyNode, depth: number, lines: AstLine[]): void {
    const branches: AnyNode[][] = node.branches || [];

    if (branches.length === 1) {
        for (const token of branches[0]) {
            walkNode(token, depth, lines);
        }
        return;
    }

    for (let i = 0; i < branches.length; i++) {
        lines.push({
            depth,
            label: `Альтернатива ${i + 1}`,
            description: 'вариант через |',
            type: 'root'
        });
        for (const token of branches[i]) {
            walkNode(token, depth + 1, lines);
        }
    }
}

function walkGroup(node: AnyNode, depth: number, lines: AstLine[]): void {
    const label = groupLabel(node);
    const description = groupDescription(node);

    lines.push({ depth, label, description, type: 'group' });

    const branches: AnyNode[][] = node.branches || [];
    for (let i = 0; i < branches.length; i++) {
        if (branches.length > 1) {
            lines.push({
                depth: depth + 1,
                label: `Альтернатива ${i + 1}`,
                description: 'вариант через |',
                type: 'root'
            });
        }
        const innerDepth = branches.length > 1 ? depth + 2 : depth + 1;
        for (const token of branches[i]) {
            walkNode(token, innerDepth, lines);
        }
    }
}

function walkRepetition(node: AnyNode, depth: number, lines: AstLine[]): void {
    const min = node.min;
    const max = node.max;
    const greedy = node.greedy;

    let quantLabel = '';
    if (min === 0 && max === Infinity) quantLabel = '*';
    else if (min === 1 && max === Infinity) quantLabel = '+';
    else if (min === 0 && max === 1) quantLabel = '?';
    else if (min === max) quantLabel = `{${min}}`;
    else if (max === Infinity) quantLabel = `{${min},}`;
    else quantLabel = `{${min},${max}}`;

    lines.push({
        depth,
        label: `Квантификатор ${quantLabel}`,
        description: quantifierDescription(min, max, greedy),
        type: 'repetition'
    });

    walkNode(node.child, depth + 1, lines);
}

function walkCharSet(node: AnyNode, depth: number, lines: AstLine[]): void {
    const negated = node.negated;
    const members: AnyNode[] = node.members || [];

    lines.push({
        depth,
        label: negated ? '[^...]' : '[...]',
        description: `набор символов${negated ? ' (отрицание)' : ''}, элементов: ${members.length}`,
        type: 'set'
    });

    for (const member of members) {
        switch (member.kind) {
            case 'char':
                lines.push({
                    depth: depth + 1,
                    label: `"${String.fromCodePoint(member.value)}"`,
                    description: 'символ в наборе',
                    type: 'char'
                });
                break;
            case 'range':
                lines.push({
                    depth: depth + 1,
                    label: `${String.fromCodePoint(member.from)}-${String.fromCodePoint(member.to)}`,
                    description: `диапазон от U+${member.from.toString(16).toUpperCase()} до U+${member.to.toString(16).toUpperCase()}`,
                    type: 'char'
                });
                break;
            case 'charset':
                walkCharSet(member, depth + 1, lines);
                break;
            case 'unicode_property':
                lines.push({
                    depth: depth + 1,
                    label: (member.negated ? '\\P{' : '\\p{') + member.property + '}',
                    description: `Unicode-свойство: ${member.property}`,
                    type: 'other'
                });
                break;
            default:
                lines.push({
                    depth: depth + 1,
                    label: member.kind || '?',
                    description: 'элемент набора',
                    type: 'other'
                });
        }
    }
}

function groupLabel(node: AnyNode): string {
    if (node.lookahead) return '(?=...)';
    if (node.negatedLookahead) return '(?!...)';
    if (node.lookbehind) return '(?<=...)';
    if (node.negatedLookbehind) return '(?<!...)';
    if (node.name) return `(?<${node.name}>...)`;
    if (node.capturing) return '(...)';
    return '(?:...)';
}

function groupDescription(node: AnyNode): string {
    if (node.lookahead) return 'позитивный просмотр вперёд';
    if (node.negatedLookahead) return 'негативный просмотр вперёд';
    if (node.lookbehind) return 'позитивный просмотр назад';
    if (node.negatedLookbehind) return 'негативный просмотр назад';
    if (node.name) return `именованная группа захвата "${node.name}"`;
    if (node.capturing) return 'группа захвата';
    return 'группа без захвата';
}

function positionDescription(value: string): string {
    switch (value) {
        case '^': return 'начало строки';
        case '$': return 'конец строки';
        case 'b': return 'граница слова';
        case 'B': return 'не граница слова';
        default: return 'позиция';
    }
}

function quantifierDescription(min: number, max: number, greedy: boolean): string {
    let base = '';
    if (min === 0 && max === Infinity) base = '0 или более раз';
    else if (min === 1 && max === Infinity) base = '1 или более раз';
    else if (min === 0 && max === 1) base = '0 или 1 раз';
    else if (min === max) base = `ровно ${min} раз`;
    else if (max === Infinity) base = `${min} или более раз`;
    else base = `от ${min} до ${max} раз`;

    return base + (greedy ? ' (жадный)' : ' (ленивый)');
}