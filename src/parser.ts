export interface Token {
    raw: string;
    description: string;
}

export function explainRegex(pattern: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < pattern.length) {
        const char = pattern[i];

        if (char === '\\' && i + 1 < pattern.length) {
            const next = pattern[i + 1];
            const escaped = char + next;
            const descriptions: { [key: string]: string } = {
                '\\d': 'любая цифра (0-9)',
                '\\D': 'любой символ, кроме цифры',
                '\\w': 'буква, цифра или подчёркивание',
                '\\W': 'любой символ, кроме буквы, цифры и подчёркивания',
                '\\s': 'пробельный символ',
                '\\S': 'любой символ, кроме пробельного',
                '\\b': 'граница слова',
                '\\B': 'не граница слова',
                '\\n': 'перенос строки',
                '\\t': 'табуляция',
                '\\r': 'возврат каретки',
            };
            tokens.push({
                raw: escaped,
                description: descriptions[escaped] || `экранированный символ "${next}"`
            });
            i += 2;
            continue;
        }

        if (char === '^') { tokens.push({ raw: '^', description: 'начало строки' }); i++; continue; }
        if (char === '$') { tokens.push({ raw: '$', description: 'конец строки' }); i++; continue; }
        if (char === '+') { tokens.push({ raw: '+', description: 'один или более раз (предыдущий элемент)' }); i++; continue; }
        if (char === '*') { tokens.push({ raw: '*', description: 'ноль или более раз (предыдущий элемент)' }); i++; continue; }
        if (char === '?') { tokens.push({ raw: '?', description: 'ноль или один раз (предыдущий элемент)' }); i++; continue; }
        if (char === '.') { tokens.push({ raw: '.', description: 'любой символ' }); i++; continue; }
        if (char === '|') { tokens.push({ raw: '|', description: 'ИЛИ' }); i++; continue; }

        if (char === '(') {
            if (pattern.substring(i, i + 3) === '(?:') { tokens.push({ raw: '(?:', description: 'группа без захвата' }); i += 3; continue; }
            if (pattern.substring(i, i + 3) === '(?=') { tokens.push({ raw: '(?=', description: 'позитивный просмотр вперёд' }); i += 3; continue; }
            if (pattern.substring(i, i + 3) === '(?!') { tokens.push({ raw: '(?!', description: 'негативный просмотр вперёд' }); i += 3; continue; }
            if (pattern.substring(i, i + 4) === '(?<=') { tokens.push({ raw: '(?<=', description: 'позитивный просмотр назад' }); i += 4; continue; }
            if (pattern.substring(i, i + 4) === '(?<!') { tokens.push({ raw: '(?<!', description: 'негативный просмотр назад' }); i += 4; continue; }
            tokens.push({ raw: '(', description: 'начало группы захвата' });
            i++;
            continue;
        }
        if (char === ')') { tokens.push({ raw: ')', description: 'конец группы' }); i++; continue; }

        if (char === '[') {
            let j = i + 1;
            let negated = false;
            if (pattern[j] === '^') { negated = true; j++; }
            while (j < pattern.length && pattern[j] !== ']') j++;
            if (j < pattern.length && pattern[j] === ']') {
                const content = pattern.substring(i + 1, j);
                tokens.push({
                    raw: pattern.substring(i, j + 1),
                    description: negated ? `любой символ, КРОМЕ: ${content}` : `один из символов: ${content}`
                });
                i = j + 1;
                continue;
            }
        }

        if (char === '{') {
            const match = pattern.substring(i).match(/^\{(\d+)(?:,(\d*))?\}/);
            if (match) {
                const raw = match[0];
                if (match[2] === undefined) tokens.push({ raw, description: `ровно ${match[1]} раз` });
                else if (match[2] === '') tokens.push({ raw, description: `${match[1]} или более раз` });
                else tokens.push({ raw, description: `от ${match[1]} до ${match[2]} раз` });
                i += raw.length;
                continue;
            }
        }

        tokens.push({ raw: char, description: `символ "${char}"` });
        i++;
    }

    return tokens;
}