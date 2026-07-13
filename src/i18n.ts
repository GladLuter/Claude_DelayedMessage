// Локализация всех пользовательских строк. По умолчанию английский (публичный
// релиз), переключение — через config.lang (команда `cdm lang <code>`). Команды
// хука/тика/доставки читают язык из config, поэтому строки не хардкодятся.

export type Lang = "en" | "ru" | "uk";
export const LANGS: Lang[] = ["en", "ru", "uk"];

export function isLang(code: string): code is Lang {
  return (LANGS as string[]).includes(code);
}

export interface Messages {
  // cli — общие
  errorPrefix: string;
  noMessageText: string;
  noMessageTextStdin: string;
  sessionUndetected: (dir: string) => string;
  added: (line: string) => string;
  queueEmpty: string;
  noItem: (id: string) => string;
  itemAlready: (id: string, status: string) => string;
  updated: (line: string) => string;
  canceled: (id: string) => string;
  logEmpty: string;
  schedulerRegistered: (min: number) => string;
  skillInstalled: (path: string) => string;
  hookRegistered: string;
  uninstalled: string;
  // cli — status
  statusScheduler: (on: boolean) => string;
  statusTickCli: (p: string) => string;
  statusClaude: (p: string) => string;
  statusTokenFresh: (d: string) => string;
  statusTokenExpired: (d: string) => string;
  statusLastTick: (t: string) => string;
  statusNever: string;
  statusProbeError: (e: string) => string;
  statusQueue: (pending: number, total: number) => string;
  // cli — lang
  langSet: (code: string) => string;
  langCurrent: (code: string, avail: string) => string;
  langUnknown: (code: string, avail: string) => string;
  // форматирование элемента очереди
  fmtAt: (when: string) => string;
  fmtLimits: string;
  fmtExpect: (when: string) => string;
  fmtFallback: string;
  fmtPerm: (mode: string) => string;
  // hook (ответы в чат, префикс DelayedMessage:)
  hkQueueEmpty: string;
  hkNoItem: (id: string) => string;
  hkItemAlready: (id: string, status: string) => string;
  hkCanceled: (id: string) => string;
  hkUpdated: (line: string) => string;
  hkError: (msg: string) => string;
  hkEmptyMessage: string;
  hkNoSession: string;
  hkQueued: (id: string, cond: string, project: string) => string;
  hkCondAt: (when: string) => string;
  hkCondReset: string;
  // уведомления (tick/deliver)
  ntFallback: (id: string) => string;
  ntAuth: string;
  ntProbeFail: (n: number) => string;
  ntDelivered: (project: string) => string;
  ntFailed: (project: string, id: string) => string;
  ntTimedOut: (project: string, id: string) => string;
  ntDeliveryError: (id: string, detail: string) => string;
  // settings-hook
  settingsCorrupt: (path: string) => string;
}

const en: Messages = {
  errorPrefix: "Error: ",
  noMessageText: "no message text: pass -m <text> or --message-file <path>",
  noMessageTextStdin: "no message text: pass -m, --message-file, or pipe text via stdin",
  sessionUndetected: (dir) => `could not detect a session for ${dir}: pass --session <id>`,
  added: (line) => `Queued: ${line}`,
  queueEmpty: "Queue is empty.",
  noItem: (id) => `no item ${id}`,
  itemAlready: (id, status) => `item ${id} is already ${status}`,
  updated: (line) => `Updated: ${line}`,
  canceled: (id) => `Canceled: [${id}]`,
  logEmpty: "Delivery log is empty.",
  schedulerRegistered: (min) => `Scheduler registered (tick every ${min} min).`,
  skillInstalled: (path) => `Skill installed: ${path}`,
  hookRegistered: "/delay hook registered (queues without spending a model turn).",
  uninstalled: "Scheduler, skill, and hook removed. Data in ~/.claude-delayed-message is kept.",
  statusScheduler: (on) => `Scheduler: ${on ? "registered" : "NOT registered"}`,
  statusTickCli: (p) => `Tick CLI: ${p}`,
  statusClaude: (p) => `claude: ${p}`,
  statusTokenFresh: (d) => `CLI token: valid until ${d}`,
  statusTokenExpired: (d) => `CLI token: EXPIRED ${d} — run: claude auth login`,
  statusLastTick: (t) => `Last tick: ${t}`,
  statusNever: "never",
  statusProbeError: (e) => `Probe error: ${e}`,
  statusQueue: (pending, total) => `Queue: ${pending} pending / ${total} total`,
  langSet: (code) => `Language set to ${code}.`,
  langCurrent: (code, avail) => `Language: ${code} (available: ${avail})`,
  langUnknown: (code, avail) => `Unknown language "${code}". Available: ${avail}`,
  fmtAt: (when) => `at ${when}`,
  fmtLimits: "after limits reset",
  fmtExpect: (when) => ` (expected ~${when})`,
  fmtFallback: " [fell back from at]",
  fmtPerm: (mode) => `[perm: ${mode}]`,
  hkQueueEmpty: "DelayedMessage: queue is empty.",
  hkNoItem: (id) => `DelayedMessage: no item ${id}.`,
  hkItemAlready: (id, status) => `DelayedMessage: [${id}] is already ${status}.`,
  hkCanceled: (id) => `DelayedMessage: canceled [${id}].`,
  hkUpdated: (line) => `DelayedMessage: updated ${line}`,
  hkError: (msg) => `DelayedMessage: ${msg}`,
  hkEmptyMessage: "DelayedMessage: empty message — nothing to queue.",
  hkNoSession: "DelayedMessage: could not determine the session (session_id missing).",
  hkQueued: (id, cond, project) =>
    `DelayedMessage: queued [${id}] ${cond} → ${project}. Cancel: /delay cancel ${id} · Queue: /delay list`,
  hkCondAt: (when) => `for ${when}`,
  hkCondReset: "after limits reset",
  ntFallback: (id) => `Limits busy — ${id} will go out after reset`,
  ntAuth: "claude CLI is not authenticated (401): run claude auth login in a terminal — the queue is waiting",
  ntProbeFail: (n) => `Limit probe is failing (${n} ticks in a row) — details: cdm status`,
  ntDelivered: (project) => `Message delivered: ${project}`,
  ntFailed: (project, id) => `Delivery failed (${project}): ${id}`,
  ntTimedOut: (project, id) =>
    `Delivery timed out (${project}): ${id} — the message was delivered, completion unconfirmed`,
  ntDeliveryError: (id, detail) => `Delivery error ${id}: ${detail}`,
  settingsCorrupt: (path) => `settings.json is corrupt (${path}) — fix it manually and re-run cdm install`,
};

const ru: Messages = {
  errorPrefix: "Ошибка: ",
  noMessageText: "нет текста сообщения: укажите -m <текст> или --message-file <путь>",
  noMessageTextStdin: "нет текста сообщения: укажите -m, --message-file или подайте текст через stdin",
  sessionUndetected: (dir) => `не удалось определить сессию для ${dir}: укажите --session <id>`,
  added: (line) => `Добавлено: ${line}`,
  queueEmpty: "Очередь пуста.",
  noItem: (id) => `нет элемента ${id}`,
  itemAlready: (id, status) => `элемент ${id} уже ${status}`,
  updated: (line) => `Обновлено: ${line}`,
  canceled: (id) => `Отменено: [${id}]`,
  logEmpty: "Журнал пуст.",
  schedulerRegistered: (min) => `Планировщик зарегистрирован (тик каждые ${min} мин).`,
  skillInstalled: (path) => `Скилл установлен: ${path}`,
  hookRegistered: "Хук /delay зарегистрирован (постановка в очередь без хода модели).",
  uninstalled: "Планировщик снят, скилл и хук удалены. Данные в ~/.claude-delayed-message сохранены.",
  statusScheduler: (on) => `Планировщик: ${on ? "зарегистрирован" : "НЕ зарегистрирован"}`,
  statusTickCli: (p) => `CLI тика: ${p}`,
  statusClaude: (p) => `claude: ${p}`,
  statusTokenFresh: (d) => `Токен CLI: свеж до ${d}`,
  statusTokenExpired: (d) => `Токен CLI: ИСТЁК ${d} — выполните: claude auth login`,
  statusLastTick: (t) => `Последний тик: ${t}`,
  statusNever: "никогда",
  statusProbeError: (e) => `Ошибка зонда: ${e}`,
  statusQueue: (pending, total) => `Очередь: ${pending} pending / ${total} всего`,
  langSet: (code) => `Язык переключён на ${code}.`,
  langCurrent: (code, avail) => `Язык: ${code} (доступно: ${avail})`,
  langUnknown: (code, avail) => `Неизвестный язык "${code}". Доступно: ${avail}`,
  fmtAt: (when) => `в ${when}`,
  fmtLimits: "после сброса лимитов",
  fmtExpect: (when) => ` (ожидаем ~${when})`,
  fmtFallback: " [fallback из at]",
  fmtPerm: (mode) => `[perm: ${mode}]`,
  hkQueueEmpty: "DelayedMessage: очередь пуста.",
  hkNoItem: (id) => `DelayedMessage: нет элемента ${id}.`,
  hkItemAlready: (id, status) => `DelayedMessage: [${id}] уже ${status}.`,
  hkCanceled: (id) => `DelayedMessage: отменено [${id}].`,
  hkUpdated: (line) => `DelayedMessage: обновлено ${line}`,
  hkError: (msg) => `DelayedMessage: ${msg}`,
  hkEmptyMessage: "DelayedMessage: пустое сообщение — нечего ставить в очередь.",
  hkNoSession: "DelayedMessage: не удалось определить сессию (session_id отсутствует).",
  hkQueued: (id, cond, project) =>
    `DelayedMessage: поставлено в очередь [${id}] ${cond} → ${project}. Отменить: /delay cancel ${id} · Очередь: /delay list`,
  hkCondAt: (when) => `к ${when}`,
  hkCondReset: "после сброса лимитов",
  ntFallback: (id) => `Лимиты заняты — ${id} уйдёт после сброса`,
  ntAuth: "claude CLI не аутентифицирован (401): выполните claude auth login в терминале — очередь ждёт",
  ntProbeFail: (n) => `Зонд лимитов падает (${n} тиков подряд) — подробности: cdm status`,
  ntDelivered: (project) => `Сообщение доставлено: ${project}`,
  ntFailed: (project, id) => `Доставка провалена (${project}): ${id}`,
  ntTimedOut: (project, id) =>
    `Доставка прервана по таймауту (${project}): ${id} — сообщение доставлено, завершение не подтверждено`,
  ntDeliveryError: (id, detail) => `Ошибка доставки ${id}: ${detail}`,
  settingsCorrupt: (path) => `settings.json повреждён (${path}) — исправьте его вручную и повторите cdm install`,
};

const uk: Messages = {
  errorPrefix: "Помилка: ",
  noMessageText: "немає тексту повідомлення: вкажіть -m <текст> або --message-file <шлях>",
  noMessageTextStdin: "немає тексту повідомлення: вкажіть -m, --message-file або передайте текст через stdin",
  sessionUndetected: (dir) => `не вдалося визначити сесію для ${dir}: вкажіть --session <id>`,
  added: (line) => `Додано: ${line}`,
  queueEmpty: "Черга порожня.",
  noItem: (id) => `немає елемента ${id}`,
  itemAlready: (id, status) => `елемент ${id} вже ${status}`,
  updated: (line) => `Оновлено: ${line}`,
  canceled: (id) => `Скасовано: [${id}]`,
  logEmpty: "Журнал порожній.",
  schedulerRegistered: (min) => `Планувальник зареєстровано (тік кожні ${min} хв).`,
  skillInstalled: (path) => `Скіл встановлено: ${path}`,
  hookRegistered: "Хук /delay зареєстровано (постановка в чергу без ходу моделі).",
  uninstalled: "Планувальник знято, скіл і хук видалено. Дані в ~/.claude-delayed-message збережено.",
  statusScheduler: (on) => `Планувальник: ${on ? "зареєстровано" : "НЕ зареєстровано"}`,
  statusTickCli: (p) => `CLI тіка: ${p}`,
  statusClaude: (p) => `claude: ${p}`,
  statusTokenFresh: (d) => `Токен CLI: дійсний до ${d}`,
  statusTokenExpired: (d) => `Токен CLI: ЗАКІНЧИВСЯ ${d} — виконайте: claude auth login`,
  statusLastTick: (t) => `Останній тік: ${t}`,
  statusNever: "ніколи",
  statusProbeError: (e) => `Помилка зонда: ${e}`,
  statusQueue: (pending, total) => `Черга: ${pending} pending / ${total} всього`,
  langSet: (code) => `Мову переключено на ${code}.`,
  langCurrent: (code, avail) => `Мова: ${code} (доступно: ${avail})`,
  langUnknown: (code, avail) => `Невідома мова "${code}". Доступно: ${avail}`,
  fmtAt: (when) => `о ${when}`,
  fmtLimits: "після скидання лімітів",
  fmtExpect: (when) => ` (очікуємо ~${when})`,
  fmtFallback: " [fallback з at]",
  fmtPerm: (mode) => `[perm: ${mode}]`,
  hkQueueEmpty: "DelayedMessage: черга порожня.",
  hkNoItem: (id) => `DelayedMessage: немає елемента ${id}.`,
  hkItemAlready: (id, status) => `DelayedMessage: [${id}] вже ${status}.`,
  hkCanceled: (id) => `DelayedMessage: скасовано [${id}].`,
  hkUpdated: (line) => `DelayedMessage: оновлено ${line}`,
  hkError: (msg) => `DelayedMessage: ${msg}`,
  hkEmptyMessage: "DelayedMessage: порожнє повідомлення — нічого ставити в чергу.",
  hkNoSession: "DelayedMessage: не вдалося визначити сесію (session_id відсутній).",
  hkQueued: (id, cond, project) =>
    `DelayedMessage: поставлено в чергу [${id}] ${cond} → ${project}. Скасувати: /delay cancel ${id} · Черга: /delay list`,
  hkCondAt: (when) => `на ${when}`,
  hkCondReset: "після скидання лімітів",
  ntFallback: (id) => `Ліміти зайняті — ${id} піде після скидання`,
  ntAuth: "claude CLI не автентифіковано (401): виконайте claude auth login у терміналі — черга чекає",
  ntProbeFail: (n) => `Зонд лімітів падає (${n} тіків поспіль) — деталі: cdm status`,
  ntDelivered: (project) => `Повідомлення доставлено: ${project}`,
  ntFailed: (project, id) => `Доставку провалено (${project}): ${id}`,
  ntTimedOut: (project, id) =>
    `Доставку перервано за таймаутом (${project}): ${id} — повідомлення доставлено, завершення не підтверджено`,
  ntDeliveryError: (id, detail) => `Помилка доставки ${id}: ${detail}`,
  settingsCorrupt: (path) => `settings.json пошкоджено (${path}) — виправте його вручну та повторіть cdm install`,
};

const CATALOG: Record<Lang, Messages> = { en, ru, uk };

/** Каталог сообщений для языка; неизвестный код откатывается к английскому. */
export function messages(lang: string | undefined): Messages {
  return CATALOG[lang as Lang] ?? en;
}
