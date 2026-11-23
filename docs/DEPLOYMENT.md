# Deployment notes

AI-WORK-TOOLS is an independent Node.js service. Deploy the `ai-work-tools` branch to a Node-compatible host (Render, Railway, or a VPS). Cloudflare Pages alone does not run this Express server without adapting it to Workers.

## Required production variables

- `ADMIN_USERNAME`: administrator login name.
- `ADMIN_PASSWORD`: strong unique password.
- `SESSION_SECRET`: random secret of at least 32 characters.
- `ALLOWED_ORIGIN`: exact HTTPS origin of this service's frontend.
- `BROWSER_ALLOWED_HOSTS`: comma-separated exact hostnames the Playwright browser is allowed to visit. The browser endpoint is disabled when this is empty.

The server refuses to start in production when required credentials/origin are missing. Do not commit `.env` or API credentials.

## Current capabilities and boundaries

- Playwright Chromium is installed by the Docker image. The screenshot endpoint requires an admin session and a hostname allowlist; requests and redirects are checked, and non-public IP destinations are blocked.
- GitHub operations currently use the ChatGPT GitHub connector, not a credential stored in this service.
- Browser Use and Open Interpreter have local install instructions; they are not running as hosted agents yet.
- Terminal execution is intentionally disabled. Do not expose an unrestricted shell endpoint.
- Tool status in the dashboard is informational; it does not start or stop external runtimes.

## Before public launch

Add persistent session storage, hashed administrator credentials, CSRF protection appropriate to the chosen auth model, distributed rate limiting, durable audit logs, and stronger network-level egress isolation for browser workloads. Run the CI workflow and verify deployment health before using the service.
