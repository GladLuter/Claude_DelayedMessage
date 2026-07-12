# Changelog

All notable changes to this project are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.0 — 2026-07-13

First public release.

### Features

- **`/delay` slash command** — queueing runs in a local `UserPromptExpansion` hook, so it works even when your usage limits are fully exhausted (no model turn is needed to enqueue).
- **Delivery into the same session** via headless `claude --resume` as soon as limits reset — early resets are caught within one 10-minute tick — or at a fixed time (`/delay at "tomorrow 9:00" …`).
- **Cross-platform background tick** — Windows Task Scheduler (run hidden via a `wscript` launcher, so no console window flashes or steals focus), macOS launchd, Linux systemd timer / cron.
- **Zero-cost probing while limited**, and probe failures are never silent: `[AUTH]` detection for an expired CLI token (desktop toast pointing to `claude auth login`), a probe-error journal, and `cdm status` showing the last error plus the CLI token expiry.
- **`cdm` CLI** — `add`, `list`, `edit`, `cancel`, `log`, `status`, `run-once`, `install`, `uninstall`, and `lang`.
- **Internationalized output** — English by default, switchable per install with `cdm lang <code>` (English and Russian included).

### Notes

- Delivered runs inherit exactly the target project's Claude Code permissions; the tool never adds permission flags.
- 82 unit tests. Licensed under PolyForm Noncommercial 1.0.0 — free for noncommercial use; commercial licensing via gladluter@gmail.com.
- Known: a Node `DEP0190` deprecation warning surfaces on Windows (static args under `shell: true` — safe, tracked for a future release).
