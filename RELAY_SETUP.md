# Enable cellular transfers

> **Experimental and unverified:** this project failed its intended cellular-to-cellular use case. The relay integration below has not been validated with a live provider or real cellular transfers. These instructions are preserved for experimentation and do not promise working cellular sharing.

When two cellular networks cannot connect the browsers directly, QuickDrop needs a TURN relay. The relay carries encrypted WebRTC packets. Files still require recipient acceptance and are assembled in the receiving browser; the app does not upload files to a storage service.

The integration is prepared for Cloudflare Realtime TURN. It is **inactive until you supply a TURN key**. No account, key, billing setting, deployment or paid service has been created by these changes.

## 1. Create a TURN key

Sign in to your Cloudflare account and create a Realtime TURN key using [Cloudflare's credential setup guide](https://developers.cloudflare.com/realtime/turn/generate-credentials/). Save its **TURN key ID** and **TURN key API token** privately.

Cloudflare currently documents a shared Realtime free allowance of 1,000 GB, then $0.05 per GB of TURN egress. Review the [current TURN pricing and measurement rules](https://developers.cloudflare.com/realtime/turn/faq/) in your account before enabling it. A 500 MB app transfer is not a guaranteed 500 MB of billed usage: relay allocation and protocol overhead affect usage.

Choose a private connection code for yourself and your friend. Use a long, unpredictable code. This code restricts access to this app's credential endpoint. Do not share the provider API token with your friend or put it in the website source.

## 2. Configure the server

For the current **Codespaces preview**, copy `.env.example` to `.env` if needed, then fill these three values in that file:

```dotenv
TURN_KEY_ID=your-turn-key-id
TURN_KEY_API_TOKEN=your-turn-key-api-token
RELAY_ACCESS_CODE=your-private-connection-code
```

These are server-only variables. **Do not prefix them with `VITE_`.** Restart the preview server after changing them:

```sh
npm run dev -- --port 5174 --strictPort
```

Open the single forwarded HTTPS URL on both devices. The development server permits the exact current Codespace hostname for its configured port and recognizes the HTTPS origin behind the forwarding proxy, including Codespaces rewriting it to loopback for the exact current port. After updating the app, reload both pages. If the Codespaces port is private, both browsers need authorized GitHub access. This is separate from whether WebRTC can connect them.

For a **Cloudflare Pages deployment**, deploy the repository through Git integration or Wrangler so the root `functions/api/ice.ts` is included. Dashboard ZIP uploads cannot deploy Pages Functions. Add the three variables as encrypted secrets under the Pages project's **Settings → Variables and Secrets**, then redeploy. See [Pages Function deployment](https://developers.cloudflare.com/pages/functions/get-started/) and [secret bindings](https://developers.cloudflare.com/pages/functions/bindings/#secrets).

The `quickdrop-pages.zip` artifact contains the static direct-only site. It does not contain the credential service or secrets.

## 3. Connect on cellular

1. Reload the updated app on both devices and accept the terms.
2. Start creating an offer or answer. If asked for a connection code, open **Settings → Connection code**, enter the private code, close Settings and try again. Give your friend only this code.
3. Exchange a new offer and answer. Old pairing text has no relay routes.
4. Keep both pages open. After pairing starts, **Settings → Relay fallback** should show **Enabled**. **Connection diagnostics → Local / remote relay routes** shows discovered relay route counts. The count alone does not prove that a relay was selected or that a transfer will succeed.
5. Test a small file in each direction and save it. Then test larger files as needed. Transfers remain one at a time, with a 500 MiB total limit and a 10-minute session.

When pairing starts, the browser first checks relay availability with a read-only GET. It requests credentials with POST only if the relay is configured. Direct-only previews never depend on a credential POST. The credential endpoint generates a fresh 20-minute credential, removes browser-blocked port 53 URLs, and returns only the short-lived ICE server credentials with caching disabled. The provider API token remains on the server. The private connection code and relay credentials are kept in browser memory, never localStorage or copied diagnostics.

Changing networks, backgrounding the page or locking the phone can still interrupt WebRTC. A relay improves network reachability but cannot guarantee connectivity. No physical cellular-network or real Cloudflare relay transfer has been verified in this workspace; automated tests validate the integration using mocked credentials and real direct browser transfers.
