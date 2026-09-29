export interface Snippet {
    name: string;
    pattern: string;
    category: string;
}

export const snippets: Snippet[] = [
    // === Валидация ===
    { name: 'Email', pattern: '^[\\w.-]+@[\\w.-]+\\.\\w{2,}$', category: 'Валидация' },
    { name: 'URL', pattern: '^https?://[\\w.-]+(?::\\d+)?(?:/[^\\s]*)?$', category: 'Валидация' },
    { name: 'IPv4', pattern: '^(?:\\d{1,3}\\.){3}\\d{1,3}$', category: 'Валидация' },
    { name: 'IPv6', pattern: '^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$', category: 'Валидация' },
    { name: 'MAC-адрес', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', category: 'Валидация' },
    { name: 'Телефон RU', pattern: '^\\+?7?\\d{10}$', category: 'Валидация' },
    { name: 'Телефон US', pattern: '^\\+?1?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$', category: 'Валидация' },
    { name: 'Пароль (8+)', pattern: '^.{8,}$', category: 'Валидация' },
    { name: 'Пароль (сильный)', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$', category: 'Валидация' },
    { name: 'Hex-цвет', pattern: '^#[0-9A-Fa-f]{6}$', category: 'Валидация' },
    { name: 'Hex-цвет (краткий)', pattern: '^#[0-9A-Fa-f]{3}$', category: 'Валидация' },
    { name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', category: 'Валидация' },
    { name: 'Карта (16)', pattern: '^\\d{16}$', category: 'Валидация' },
    { name: 'Visa', pattern: '^4\\d{12}(\\d{3})?$', category: 'Валидация' },
    { name: 'MasterCard', pattern: '^5[1-5]\\d{14}$', category: 'Валидация' },
    { name: 'Индекс RU', pattern: '^\\d{6}$', category: 'Валидация' },
    { name: 'Индекс US', pattern: '^\\d{5}(-\\d{4})?$', category: 'Валидация' },
    { name: 'Slug', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', category: 'Валидация' },
    { name: 'Username', pattern: '^[a-zA-Z0-9_]{3,16}$', category: 'Валидация' },
    { name: 'Base64', pattern: '^[A-Za-z0-9+/]*={0,2}$', category: 'Валидация' },
    { name: 'MD5-хеш', pattern: '^[a-f0-9]{32}$', category: 'Валидация' },
    { name: 'SHA-1', pattern: '^[a-f0-9]{40}$', category: 'Валидация' },
    { name: 'SHA-256', pattern: '^[a-f0-9]{64}$', category: 'Валидация' },
    { name: 'JWT', pattern: '^eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$', category: 'Валидация' },
    { name: 'Bool', pattern: '^(true|false)$', category: 'Валидация' },

    // === Даты и время ===
    { name: 'Дата YYYY-MM-DD', pattern: '^\\d{4}-\\d{2}-\\d{2}$', category: 'Даты и время' },
    { name: 'Дата DD.MM.YYYY', pattern: '^\\d{2}\\.\\d{2}\\.\\d{4}$', category: 'Даты и время' },
    { name: 'Дата MM/DD/YYYY', pattern: '^\\d{2}/\\d{2}/\\d{4}$', category: 'Даты и время' },
    { name: 'Время HH:MM', pattern: '^\\d{2}:\\d{2}$', category: 'Даты и время' },
    { name: 'Время HH:MM:SS', pattern: '^\\d{2}:\\d{2}:\\d{2}$', category: 'Даты и время' },
    { name: 'ISO 8601', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})?$', category: 'Даты и время' },
    { name: 'Timestamp в логе', pattern: '\\d{4}-\\d{2}-\\d{2}[T\\s]\\d{2}:\\d{2}:\\d{2}', category: 'Даты и время' },

    // === Числа ===
    { name: 'Целое', pattern: '^-?\\d+$', category: 'Числа' },
    { name: 'Положительное целое', pattern: '^\\d+$', category: 'Числа' },
    { name: 'Дробное', pattern: '^-?\\d+(\\.\\d+)?$', category: 'Числа' },
    { name: 'Float', pattern: '^-?\\d+\\.\\d+$', category: 'Числа' },
    { name: 'Научное', pattern: '^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$', category: 'Числа' },
    { name: 'Двоичное', pattern: '^[01]+$', category: 'Числа' },
    { name: 'Hex-число', pattern: '^0x[0-9A-Fa-f]+$', category: 'Числа' },
    { name: 'Процент', pattern: '^\\d+(\\.\\d+)?%$', category: 'Числа' },
    { name: 'USD', pattern: '^\\$\\d+(\\.\\d{2})?$', category: 'Числа' },
    { name: 'Рубли', pattern: '^\\d+([.,]\\d{2})?\\s?(₽|руб)$', category: 'Числа' },
    { name: 'Римское число', pattern: '^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$', category: 'Числа' },

    // === Web ===
    { name: 'HTML-тег', pattern: '<([a-z][a-z0-9]*)\\b[^>]*>(.*?)</\\1>', category: 'Web' },
    { name: 'HTML-коммент', pattern: '<!--[\\s\\S]*?-->', category: 'Web' },
    { name: 'HTML href', pattern: '<a[^>]+href=["\\\']([^"\\\']+)["\\\']', category: 'Web' },
    { name: 'HTML img src', pattern: '<img[^>]+src=["\\\']([^"\\\']+)["\\\']', category: 'Web' },
    { name: 'CSS-свойство', pattern: '([\\w-]+)\\s*:\\s*([^;]+);', category: 'Web' },
    { name: 'Query-параметр', pattern: '[?&]([^=&#]+)=([^&#]*)', category: 'Web' },
    { name: 'URL-протокол', pattern: '^([a-z][a-z0-9+.-]*):', category: 'Web' },
    { name: 'URL-домен', pattern: '^(?:https?://)?([^/:]+)', category: 'Web' },
    { name: 'URL-путь', pattern: '(?:https?://)?[^/]+(/[^?\\s]*)', category: 'Web' },
    { name: 'URL-хеш', pattern: '#(\\S*)$', category: 'Web' },
    { name: 'Домен из email', pattern: '@([\\w.-]+\\.\\w+)', category: 'Web' },
    { name: 'HTML-entity', pattern: '&[a-zA-Z]+;|&#\\d+;|&#x[0-9a-fA-F]+;', category: 'Web' },
    { name: 'YouTube-ссылка', pattern: '^(https?://)?(www\\.)?(youtube\\.com|youtu\\.be)/.+$', category: 'Web' },
    { name: 'Telegram-ссылка', pattern: '^(https?://)?(t\\.me|telegram\\.me)/[a-zA-Z0-9_]+$', category: 'Web' },
    { name: 'Discord-инвайт', pattern: '^(https?://)?(discord\\.gg|discord\\.com/invite)/[a-zA-Z0-9]+$', category: 'Web' },

    // === Разработка ===
    { name: 'JSON-ключ', pattern: '"([^"\\\\]|\\\\.)*"\\s*:', category: 'Разработка' },
    { name: 'JSON-строка', pattern: '"([^"\\\\]|\\\\.)*"', category: 'Разработка' },
    { name: 'XML-атрибут', pattern: '(\\w+)=["\\\']([^"\\\']*)["\\\']', category: 'Разработка' },
    { name: 'SQL SELECT', pattern: 'SELECT\\s+.+?\\s+FROM\\s+.+?(?=;|$)', category: 'Разработка' },
    { name: 'Markdown-ссылка', pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)', category: 'Разработка' },
    { name: 'Markdown-bold', pattern: '\\*\\*([^*]+)\\*\\*', category: 'Разработка' },
    { name: 'Markdown-курсив', pattern: '\\*([^*]+)\\*', category: 'Разработка' },
    { name: 'Markdown-заголовок', pattern: '^#{1,6}\\s+(.+)$', category: 'Разработка' },
    { name: 'Markdown-код', pattern: '`([^`]+)`', category: 'Разработка' },
    { name: 'Log ERROR', pattern: '\\b(ERROR|FATAL)\\b', category: 'Разработка' },
    { name: 'Log IP', pattern: '\\b\\d{1,3}(?:\\.\\d{1,3}){3}\\b', category: 'Разработка' },
    { name: 'Путь Windows', pattern: '^[A-Za-z]:\\\\(?:[^\\\\/:*?"<>|\\r\\n]+\\\\)*[^\\\\/:*?"<>|\\r\\n]*$', category: 'Разработка' },
    { name: 'Путь Unix', pattern: '^(/[^/\\0]+)+/?$', category: 'Разработка' },
    { name: 'Имя файла', pattern: '^[\\w\\-. ]+\\.[A-Za-z0-9]+$', category: 'Разработка' },
    { name: 'Расширение', pattern: '\\.([a-zA-Z0-9]+)$', category: 'Разработка' },

    // === Извлечение ===
    { name: 'Хештег', pattern: '#\\w+', category: 'Извлечение' },
    { name: 'Упоминание', pattern: '@\\w+', category: 'Извлечение' },
    { name: 'Дубликат слова', pattern: '\\b(\\w+)\\s+\\1\\b', category: 'Извлечение' },
    { name: 'Пробелы в конце', pattern: '[ \\t]+$', category: 'Извлечение' },
    { name: 'Пустые строки', pattern: '^\\s*$', category: 'Извлечение' },
    { name: 'Unicode-escape', pattern: '\\\\u[0-9a-fA-F]{4}', category: 'Извлечение' },
    { name: 'Backslash-escape', pattern: '\\\\[nrt"\\\'\\\\]', category: 'Извлечение' },

    // === Россия ===
    { name: 'ИНН (10)', pattern: '^\\d{10}$', category: 'Россия' },
    { name: 'ИНН (12)', pattern: '^\\d{12}$', category: 'Россия' },
    { name: 'ОГРН', pattern: '^\\d{13}$', category: 'Россия' },
    { name: 'СНИЛС', pattern: '^\\d{3}-\\d{3}-\\d{3} \\d{2}$', category: 'Россия' },
    { name: 'Паспорт РФ', pattern: '^\\d{2}\\s?\\d{2}\\s?\\d{6}$', category: 'Россия' },
    { name: 'Авто-номер РФ', pattern: '^[АВЕКМНОРСТУХ]\\d{3}[АВЕКМНОРСТУХ]{2}\\d{2,3}$', category: 'Россия' },

    // === Координаты и стандарты ===
    { name: 'Широта', pattern: '^-?([1-8]?\\d(\\.\\d+)?|90(\\.0+)?)$', category: 'Координаты' },
    { name: 'Долгота', pattern: '^-?(180(\\.0+)?|((1[0-7]\\d)|([1-9]?\\d))(\\.\\d+)?)$', category: 'Координаты' },
    { name: 'ISBN-10', pattern: '^\\d{9}[\\dX]$', category: 'Координаты' },
    { name: 'ISBN-13', pattern: '^97[89]\\d{10}$', category: 'Координаты' },
    { name: 'EAN-13', pattern: '^\\d{13}$', category: 'Координаты' },
    { name: 'IMEI', pattern: '^\\d{15}$', category: 'Координаты' },
    { name: 'Bitcoin', pattern: '^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$', category: 'Координаты' },
    { name: 'Ethereum', pattern: '^0x[a-fA-F0-9]{40}$', category: 'Координаты' }
];