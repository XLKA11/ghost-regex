import { parse } from 'regex-inspector';
import util from 'util';

const patterns = ['.', '\\w+', '\\d+', '[^\\n\\r]', '[a-z]+'];

for (const pattern of patterns) {
    console.log('===== PATTERN:', pattern, '=====');
    try {
        const ast = parse(pattern);
        console.log(util.inspect(ast, { depth: 10, colors: false }));
    } catch (e) {
        console.log('ERR', e);
    }
}