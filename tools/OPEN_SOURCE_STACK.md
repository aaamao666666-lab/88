# Open-source execution stack

## Installed in this project
- Playwright (Apache-2.0): real Chromium browser engine; backend endpoint POST /api/admin/browser/screenshot (admin session required).
- Playwright MCP: launch with npx -y @playwright/mcp@latest using mcp/playwright.config.json.

## Optional local agent runtimes
- Browser Use (MIT): Python AI browser agent. Install with: python -m pip install "browser-use==1.0.2". Browser Use library and local browser are open source; hosted browser/LLM inference may cost money.
- Open Interpreter (Apache-2.0 current Rust CLI): install per official instructions at https://github.com/openinterpreter/openinterpreter. It can inspect repositories, edit files, run commands and review diffs. Run locally with explicit workspace permissions; do not expose unrestricted shell execution as a public HTTP endpoint.
- OpenHands (MIT core): https://github.com/OpenHands/OpenHands. Full coding-agent runtime is heavier and should be deployed separately with its own sandbox and resource limits.

## License notes
Playwright core: Apache-2.0. Browser Use: MIT. Open Interpreter: Apache-2.0. OpenHands core: MIT; some enterprise subdirectories have separate licensing. Review upstream licenses before redistribution.
