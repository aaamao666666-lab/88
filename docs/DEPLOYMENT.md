# Deployment notes

This repository contains the AI-WORK-TOOLS frontend and Express API prototype.

Do not commit `.env` or API credentials. Configure ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET, ALLOWED_ORIGIN as deployment environment variables. The current app is a Node.js service; deploy it to a Node-compatible host (Render, Railway, or a VPS). Cloudflare Pages alone does not run this Express server without adapting it to Workers.

Before public launch, add persistent session storage, password hashing, CSRF protection, rate limiting, and durable audit logs. Tool adapters are not yet connected.