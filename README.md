# claude-delayed-message

**Queue a message for your Claude Code session — it gets delivered the moment your usage limits reset, or at a time you choose.**

You hit your Claude usage limit at 11 PM. The limits reset at 2 AM — while you sleep. Without this tool your next 5-hour limit window starts only when you type your next message in the morning. With it, your queued message fires at 2 AM, the session keeps working, and by the time you're back the *next* reset is already hours closer.

> English · [Русская версия](README.ru.md)

Developed with the support of [infilarite](https://infilarite.com/).

## Install (2 commands)

```bash
npm install -g claude-delayed-message
cdm install
```

`cdm install` registers a lightweight background check (Windows Task Scheduler / macOS launchd / Linux systemd timer or cron — every 10 minutes) and installs the `/delay` skill into `~/.claude/skills/`. It also resolves the absolute path to your `claude` binary so the scheduled task can find it even without your shell's PATH.

## Use it from any Claude Code chat

```
/delay Continue the refactoring we discussed: extract the parser into its own module
```

> Queued [a1b2c3d4] — will be sent to this session as soon as your usage limits reset.

```
/delay at "tomorrow 9:00" Run the test suite and summarize failures
/delay list
/delay edit a1b2c3d4 Continue the refactoring, but start with tests
/delay cancel a1b2c3d4
```

Or straight from the terminal:

```bash
echo "Continue where we left off" | cdm add --project C:\work\my-app
cdm list
cdm log
cdm status
```

## How it works

```
/delay  ──►  queue (~/.claude-delayed-message/queue/*.json)
                         ▲
OS scheduler (every 10 min) ──►  cdm run-once
        ├─ queue empty        → exit (no probe, zero cost)
        ├─ "at" items due     → deliver now
        └─ "limits-reset" items:
             probe (tiny haiku request)
             ├─ limit error   → free; remember expected reset time, wait
             └─ success       → limits are back: deliver everything FIFO
                                 via  claude --resume <session> -p  (stdin)
```

- Queueing itself runs in a **local hook** (`UserPromptExpansion`) — `/delay` works even when your limits are fully exhausted, because no model turn is needed to enqueue.
- The probe is **free while you're limited** (rejected requests don't consume anything) and costs a fraction of a cent when limits are back — at which point your real message is sent immediately anyway.
- Early resets (Anthropic occasionally resets everyone's limits ahead of schedule) are caught within one tick.
- Delivery resumes **the same session ID**, so open the chat and continue where it left off.

## Commands

| Command | What it does |
|---|---|
| `cdm add -m "<text>" [--at "<time>"] [--session auto] [--project <dir>]` | Queue a message (text also accepted via `--message-file` or stdin) |
| `cdm list` | Show the queue |
| `cdm edit <id> [-m "<text>"] [--at "<time>"] [--on-reset]` | Edit a pending item |
| `cdm cancel <id>` | Cancel a pending item |
| `cdm log` | Delivery history |
| `cdm status` | Scheduler state, resolved `claude` path, last tick, queue size |
| `cdm install` / `cdm uninstall` | Register/remove the scheduler and `/delay` skill |

Time formats for `--at`: `09:00`, `tomorrow 9am`, `tomorrow 12:30pm`, ISO like `2026-07-08T09:00`. A bare `HH:MM` that already passed today rolls to tomorrow.

## FAQ

**Does the probe waste my limits?** While limited — no, rejected requests are free. When limits are available the probe is one tiny haiku request, and it only happens when something is queued.

**What permissions does the delivered run get?** Exactly what that project's Claude Code settings allow. The tool never adds permission flags (no `--dangerously-skip-permissions`, ever).

**Which session does `--session auto` pick?** The most recently active Claude Code session for that project directory. If you run several sessions against the same project at once, pass an explicit `--session <uuid>` (the UUID is visible in the `claude --resume` picker) so the message lands in the right chat.

**Where is my data?** Plain JSON in `~/.claude-delayed-message/`. Your message texts are stored there in clear text — treat the folder accordingly.

**The app was closed when the message fired — did I lose the answer?** No. The session file is shared; open the chat in Claude Code and the new turn is there.

**Nothing is being delivered — how do I find out why?** Run `cdm status`. If it shows a probe error mentioning `401` / `Failed to authenticate`, your **standalone CLI** login has expired (the desktop app refreshes its own token, the CLI does not): open any terminal, run `claude`, and log in — the queue resumes automatically on the next tick. You also get a desktop notification when this happens.

**How do I uninstall?** `cdm uninstall` removes the scheduler entry and the skill; your data folder stays.

## The CLI access token (read this once)

Probing and delivery run through the **standalone `claude` CLI** in headless mode. Its access token is separate from the Claude Code desktop app:

- The desktop app refreshes its token automatically — you can work normally for weeks while the CLI token is long expired.
- Headless mode (`claude -p`) does **not** refresh an expired token — it fails with `401 Invalid authentication credentials`.
- `claude auth status` may still print `loggedIn: true` with an expired access token — don't rely on it alone.

**Refresh:** run `claude auth login` in any terminal and complete the browser sign-in. The queue resumes automatically on the next tick — nothing else to do.

**Monitoring:** nothing manual is required. On the first failed tick you get a desktop notification, and `cdm status` shows the probe error marked `[AUTH]` (with a reminder roughly every 6 hours while the problem persists). `cdm status` also prints the token expiry date, so you can spot it going stale before anything breaks.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and other noncommercial use.

**Commercial licensing:** to use this in a commercial context, contact **gladluter@gmail.com** for a commercial license.
