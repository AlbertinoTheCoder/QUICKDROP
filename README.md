# QuickDrop

Browser-to-browser file and text sharing built with React, TypeScript and WebRTC.

[View the source on GitHub](https://github.com/AlbertinoTheCoder/quickdrop).

> **Status: failed experiment for cellular-to-cellular sharing.** The project did not achieve its intended real-world use case. Do not expect it to work between devices using cellular data in its current setup. The sources are preserved for learning and further experimentation.

Local automated browser transfers pass, but they do not demonstrate connectivity between real devices on separate mobile networks. Direct WebRTC connections can fail behind carrier NATs and firewalls. Optional TURN relay code is included, but no live relay or cellular transfer has been verified; configuring it is not a proven fix for this project.

## What is included

- Two-way file and text transfers over encrypted WebRTC data channels.
- Manual offer/answer pairing, recipient acceptance, progress and cancellation.
- English and Italian interfaces, light/dark themes and responsive layouts.
- A 500 MiB total file limit, up to 20 files per transfer, and 10-minute sessions.
- Optional server-side TURN credential integration and Cloudflare Pages function.
- Protocol, session and Chromium browser tests.

Received files are assembled in browser memory. Both pages must stay open and in the foreground. There is no file storage backend.

## Run locally

Use Node.js 22.12+ and the committed dependency lockfile.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. In Codespaces, use the forwarded HTTPS address. Exchange a complete offer and answer through a trusted channel, connect the browsers, then propose and accept a transfer. Same-network operation is a useful starting point, but device compatibility is still unverified.

```sh
npm run build       # TypeScript check and production bundle
npm test            # Protocol, session, diagnostics and relay tests
npm run test:e2e    # Chromium browser tests
```

Browser tests require Playwright Chromium (`npx playwright install chromium`) and its system dependencies.

## Repository map

| Path | Purpose |
| --- | --- |
| `client/` | React interface, translations and WebRTC transfer logic |
| `server/` | Relay credential service and preview request validation |
| `functions/` | Cloudflare Pages credential endpoint |
| `tests/` | Unit tests and browser transfer checks |
| `.env.example` | Configuration template with no credentials |

## Documentation

- [Usage and deployment guide](GUIDE.md) — pairing, limits, architecture and troubleshooting.
- [Optional relay setup](RELAY_SETUP.md) — experimental TURN configuration; cellular support remains unverified.
- [Verification history](VERIFICATION.md) — checks performed and their limitations.

## Project limitations

This is an experimental source release, not a reliable cross-network sharing service. Physical iPads, Safari behavior and real cellular-to-cellular transfers have not been verified. Publishing the website only serves the app; it does not relay peer traffic. Static ZIP uploads do not include the credential function.

Keep pairing data private. Copy `.env.example` to `.env` only when needed, and keep provider credentials server-side. Generated builds, local secrets and test artifacts are excluded from Git.
