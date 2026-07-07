---
name: delay
description: Queue a message for this Claude Code session - delivered when usage limits reset or at a specific time. Use when the user invokes /delay to defer a message, list the delay queue, cancel or edit a queued message.
---

# /delay — отложенная отправка сообщения в эту сессию

Ты — обёртка над CLI `cdm` (пакет claude-delayed-message). Все операции выполняй через Bash-инструмент из текущей папки проекта. НИКОГДА не передавай текст сообщения аргументом командной строки — только через файл.

## Разбор аргументов

Аргументы после `/delay`:

- `list` → выполни `cdm list` и покажи результат.
- `cancel <id>` → `cdm cancel <id>`.
- `edit <id> <новый текст>` → сохрани текст во временный файл, затем `cdm edit <id> --message-file <путь>`.
- `at "<время>" <текст>` → доставка в заданное время (см. ниже).
- всё остальное → текст сообщения, доставка после сброса лимитов.

## Постановка в очередь

1. Сохрани текст сообщения во временный файл (в scratchpad-каталог сессии), например `delay-msg.txt`. Текст — это ровно то, что пользователь хочет отправить в этот чат позже; не перефразируй.
2. Выполни:
   - без времени: `cdm add --session auto --project "<абсолютный путь текущего проекта>" --message-file "<путь к файлу>"`
   - со временем: `cdm add --session auto --project "<...>" --message-file "<...>" --at "<время как ввёл пользователь>"`
3. Покажи пользователю вывод `cdm` (ID и условие доставки) и одной строкой напомни: отменить — `/delay cancel <id>`, посмотреть — `/delay list`.

## Ошибки

- `cdm` не найден → предложи `npm install -g claude-delayed-message && cdm install`.
- Не определилась сессия → сообщи и предложи явный `--session <uuid>` (uuid виден в пикере `claude --resume`).
