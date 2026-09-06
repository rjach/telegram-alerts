# Security policy

## Supported versions

Only the latest published minor receives fixes.

## Reporting

Please do not open a public issue. Use [GitHub private vulnerability reporting](https://github.com/rojan-labs/telegram-alerts/security/advisories/new). You will get an acknowledgement within 72 hours and a fix or a mitigation plan within 14 days for confirmed issues.

## Scope notes

- The bot token is a secret. The package never logs it and never includes it in returned results. Reports about token leakage in logs or errors are high priority.
- Message text is sent as plain text with no `parse_mode`, so user-supplied field values cannot inject Telegram markup.
- The package has no runtime dependencies; supply-chain reports should target the dev toolchain or the publish workflow.
