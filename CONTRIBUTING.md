# Contributing

Thanks for helping improve this experiment.

## Before opening a pull request

1. Keep changes focused and explain the user-facing effect.
2. Run `npm ci` and `npm run check` locally (all regression tests plus the production build).
3. Do not present rule matches as diagnoses or add clinical claims without reliable sources and review.
4. Preserve third-party attribution and license notices when changing or replacing anatomy assets.

For data or UI changes, include a short note describing how the change was checked. This project does not promise a particular response time or support level; issues and pull requests are reviewed as time permits.

For UI/performance changes, run `npm run measure:bundle` after building and keep before/after measurements on the same runtime and compression settings. Browser-tested behavior, emulation, and untested real-device limits should be reported separately.
