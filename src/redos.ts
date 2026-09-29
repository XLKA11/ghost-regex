// @ts-ignore
import { inspect } from 'regex-inspector';

export interface RedosWarning {
    message: string;
    hint: string;
    severity: 'warning' | 'danger';
    fix?: string;
}

/**
 * Детектор ReDoS через библиотеку regex-inspector.
 */
export function detectRedos(pattern: string): RedosWarning[] {
    if (!pattern || pattern.length === 0) {
        return [];
    }

    let result;
    try {
        result = inspect(pattern);
    } catch (e) {
        return [];
    }

    const warnings: RedosWarning[] = [];

    if (!result || result.safe) {
        return warnings;
    }

    const severity = result.severity;
    const starHeight = result.starHeight || 0;
    const fix = result.fix ?? undefined;

    if (severity === 'critical') {
        warnings.push({
            message: `Критическая уязвимость ReDoS (уровень вложенности ${starHeight})`,
            hint: 'Этот regex может зависнуть на минуты при определённых входных данных. Не используй его на пользовательском вводе. ' +
                  (fix ? `Автоматическое исправление: ${fix}` : 'Упрости вложенные квантификаторы.'),
            severity: 'danger',
            fix: fix
        });
    } else if (severity === 'high') {
        warnings.push({
            message: 'Высокая уязвимость ReDoS',
            hint: 'Обнаружена вложенная квантификация или пересекающиеся альтернативы. ' +
                  (fix ? `Автоматическое исправление: ${fix}` : 'Рекомендуется упростить выражение.'),
            severity: 'danger',
            fix: fix
        });
    } else if (severity === 'low') {
        warnings.push({
            message: 'Незначительный риск ReDoS',
            hint: 'Паттерн содержит потенциально проблемную структуру, но она частично смягчена (якорями или суффиксами). ' +
                  (fix ? `Возможное исправление: ${fix}` : ''),
            severity: 'warning',
            fix: fix
        });
    }

    return warnings;
}