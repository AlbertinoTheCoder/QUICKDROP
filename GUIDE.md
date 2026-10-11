# QuickDrop

An experimental browser-only file and text sharing application. React + TypeScript + Vite + Tailwind + Lucide + Framer Motion. Files travel over an ordered, reliable encrypted WebRTC data channel. Both browsers can send within the same session. Direct connections work without a backend; optional Cloudflare TURN integration is implemented but has not been verified on real cellular networks. There is no file upload endpoint, database, or cloud file storage.

## Develop in GitHub Codespaces from your iPad

```sh
npm install
npm run dev -- --port 5174 --strictPort
```

In Codespaces, open the **Ports** tab, forward port **5174**, and open its HTTPS browser address. You do not need a computer on your home network or a local server at home. Codespaces serves the development site and, when configured, issues short-lived relay credentials; it does not receive transferred files. Each device must be able to open the same site. A private Codespaces forwarded port requires GitHub access; use a static Pages site for normal sharing. Do not expose port access unnecessarily. Vite binds to `0.0.0.0` for Codespaces forwarding.

```sh
npm run build       # TypeScript check and production bundle in dist/
npm run preview     # Preview the built static site (port 4173)
npm test            # Protocol validation, limits, expiration, ICE, backpressure
npx playwright install --with-deps chromium
npm run test:e2e    # Actual WebRTC pairing between two isolated browser contexts
```

Node 22.12+ or a current Node 24 LTS is recommended. Dependencies are locked in `package-lock.json`.

## Transfer between two browsers

1. Sender selects files or text and taps **Create connection offer**. QuickDrop waits for ICE gathering to complete before making the offer available.
2. Copy the entire `QD1.…` offer. Send it using a trusted existing channel (for example Messages, email, or AirDrop). Do not send pairing text to strangers or publish it.
3. Recipient opens QuickDrop, pastes the offer, and taps **Create connection answer**. Network discovery finishes before the answer is exported.
4. Recipient copies the answer and returns it to the sender. Sender pastes the answer and taps **Connect browsers**.
5. After both browsers show connected, sender taps **Send files** or **Send text**. Recipient reviews the filenames and sizes and taps **Accept transfer** or **Decline**. Files are not sent before acceptance.
6. QuickDrop transfers 16 KB chunks with backpressure. **Received by the other browser** appears only after the receiving browser validates and assembles all advertised bytes and sends an acknowledgment. It does **not** prove that files were saved to the device.
7. Recipient taps the download icon beside each file to save it, or uses the native share icon where supported. Text supports Copy, Select all, and Open link for HTTP(S) URLs only.

Once paired, either browser can send files or text in the same session. Transfers run one at a time, and the recipient must accept each transfer. If both browsers propose a transfer together, the offer creator’s transfer takes priority; the other browser can retry afterward.

Files are individually downloadable; this version does not build ZIP archives. Pairing QR codes are intentionally omitted: full SDP and ICE payload sizes vary and cannot reliably fit a conveniently scannable QR. There are no six-digit codes or automatic pairing services.

## iPad and network limits

- **500 MiB (524,288,000 bytes) total per transfer**, displayed as 500 MB; maximum **20 files**. Enforced on both browsers, including metadata received from an untrusted peer. Received files are assembled in browser memory, so large transfers depend on available device memory.
- Plain text is limited to **32 KiB of UTF-8 data**. All transferred text is rendered as plain text, never HTML. Files are kept as inert binary blobs and offered as downloads; there is no inline executable preview.
- Sender reads one 16 KB slice at a time. Receiver buffers accepted chunks in memory to build downloadable Blobs. Backpressure limits queued sender data to roughly 256 KiB plus one chunk. Received content from the previous transfer is released when accepting another transfer. Save files before accepting a replacement.
- Both devices must keep the page **open and in the foreground**. Safari can suspend background tabs when you switch apps or lock the iPad. Return promptly while exchanging pairing text; after connecting, keep both browsers visible. Large transfers can be interrupted by OS memory pressure.
- A **10-minute browser session lifetime** starts when the offer is created. The receiver uses the same deadline (and cannot extend its own initial lifetime). At expiration QuickDrop closes the connection and drops its references to received data. This is not server-side deletion or guaranteed secure memory erasure, and does not delete saved downloads or pairing text copied elsewhere. Device clocks should be accurate.
- Connections can fail across restrictive NATs, corporate Wi-Fi, VPNs, mobile networks, or firewalls. If no relay is configured, try another network or put the devices on the same trusted Wi-Fi. For separate cellular networks, configure the optional relay below. Connection failure is reported after 45 seconds. A stalled transfer or unaccepted proposal times out after 60 seconds. Cancellation stops outgoing reads and discards incoming buffers; late queued chunks from cancelled transfers are ignored.
- The page asks for no camera/microphone permission. No files are uploaded to the static host. WebRTC uses encrypted DTLS transport. This does not independently authenticate the human on the other device: exchange pairing data through a trusted channel.

## Language and cellular connections

In **Settings → Language**, select **English** or **Italiano**. The interface, terms, accessibility labels and transfer feedback update immediately without resetting the session. The choice is remembered on this device.

For transfers between cellular networks, see [RELAY_SETUP.md](RELAY_SETUP.md). The credential service is optional and disabled by default.

## Public STUN service

By default the peer connection uses **Google's public STUN server: `stun:stun.l.google.com:19302`**. STUN helps discover the browser's public-facing network address; it is not a relay and does not receive/store the file payload. Google can observe your IP address and STUN requests. Availability and continued free access are not guaranteed. Pairing SDP includes network candidates and identifying connection material; share it privately.

To disable external STUN, copy `.env.example` to `.env` and set `VITE_STUN_URL=` (blank). Without STUN, connectivity is generally limited to networks where local candidates are mutually reachable. You can configure another **STUN** URI with `VITE_STUN_URL`. TURN credentials are fetched from the same-origin `/api/ice` endpoint when pairing starts; they are never embedded in the static build. Vite variables are build-time configuration; rebuild after changes. No analytics or remote fonts are included. When configured, Cloudflare Realtime issues relay credentials and carries encrypted relay traffic.

Reference: [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections), [ICE gathering events](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icegatheringstatechange_event), [Data channel backpressure](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold).

## Cloudflare Pages deployment — prepared, not deployed

Use **Cloudflare Pages on its Free plan**, with the included HTTPS `*.pages.dev` address. No domain purchase, databases, object storage, or billing activation is required for the static direct-only site. The optional relay uses a Pages Function and the separately metered Cloudflare Realtime TURN service; review its current free allowance and usage pricing before activating it. If asked to enable billing or upgrade, stop and verify that you chose Pages and the Free plan.

### GitHub integration (convenient from iPad)

1. Push this repository to your GitHub account.
2. In Cloudflare, open **Workers & Pages**, choose **Create application → Pages → Connect to Git** (labels can vary), authorize the selected repository, and choose the production branch.
3. Set project root to the repository root, framework preset to **React (Vite)**, build command **`npm run build`**, output directory **`dist`**. Set `NODE_VERSION` to `24` if needed.
4. Optionally set `VITE_STUN_URL`; leave unset for the documented Google STUN default, or set empty to disable it. For relay support, add the server secrets described in RELAY_SETUP.md. The root `functions/` directory supplies the credential endpoint.
5. Review these settings. Only when you choose to deploy, select **Save and Deploy**. Cloudflare supplies a free HTTPS `pages.dev` URL.
6. Open that URL on both devices and follow the pairing flow above. A successful production build alone does not verify that their networks permit WebRTC.

### Direct upload alternative

This option serves the direct-only app. Dashboard ZIP uploads do not deploy Pages Functions; use Git integration or Wrangler for cellular relay support.

Run `npm run build` in Codespaces. Download the `dist` directory as a ZIP. In the Cloudflare dashboard choose **Pages → Direct Upload**, give the project a name, and upload the built assets. `index.html` must be at the archive root, alongside `assets/`, `favicon.svg`, and `_headers`. Do not upload source files, `node_modules`, or `.env`. Direct Upload and Git-integrated projects have different management workflows; choose one when creating the project.

The included `_headers` adds a CSP, no-referrer policy, frame protection, MIME-sniffing protection, and denies camera/microphone/geolocation. CSP allows local assets and Blob downloads. WebRTC ICE/STUN is not a fetch/XHR request. Test Safari after hosting, since browser security policy behavior can differ.

References: [Cloudflare Vite build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Free-plan limits](https://developers.cloudflare.com/pages/platform/limits/).

## Architecture

- `client/src/main.tsx`: responsive interface, pairing, clipboard, native share, settings and accessible dialogs.
- `client/src/i18n.ts`: English/Italian interface translations; language is selected in Settings and saved on this device. User filenames, shared text and pairing payloads are never translated.
- `client/src/services/ice.ts`, `server/relay.ts`, `functions/api/ice.ts`: short-lived relay credentials, server-only provider secrets and Cloudflare Pages endpoint.
- `client/src/services/peer.ts`: WebRTC session lifecycle, ICE completion, acceptance, chunk flow, cancellation and acknowledgments.
- `client/src/services/protocol.ts`: bounded pairing/control payload validation, metadata/UTF-8 limits, safe filenames and binary framing.
- `client/src/styles.css`: retained dark/light visual design, responsive layout and reduced-motion styling.
- `tests/protocol.test.ts` and `tests/session.test.ts`: deterministic validation, flow-control, acceptance, cancellation and expiration tests.
- `tests/browser/transfer.spec.ts`: real two-context pairing, file-byte comparison, acceptance, decline, cancellation and safe text display.

Only harmless theme, motion and language preferences use localStorage. The private connection code stays in memory for the visit. Transfers and pairing credentials are not persisted. Reloading or closing the page ends the connection. There is no server-side cleanup or storage to maintain.

## Physical-device verification still required

Automated Chromium contexts do not establish physical iPad Safari compatibility or connectivity between separate real networks. Before relying on the application:

1. Open the HTTPS site on two actual devices; keep pages in the foreground.
2. Pair by offer/answer and ensure both show connected.
3. Send a known file and confirm that no file bytes arrive before acceptance. Accept it, save it, and compare its bytes/hash with the source.
4. Repeat in both directions with multiple files, empty files, Unicode names, text, decline and cancellation. Check both interface languages.
5. Confirm files larger than the 500 MiB limit are rejected.
6. Let a session expire; confirm transfer controls are unavailable and a new session is necessary.
7. Try Safari's download/share controls, clipboard fallback, light theme, and VoiceOver. Test interruption by backgrounding/locking and verify a clear reconnect path.

See `VERIFICATION.md` for checks actually performed in this workspace. No physical-device test is implied.

## Troubleshooting direct connection failures

Making a Codespaces port public or publishing the static site only makes the page accessible. It does not relay WebRTC traffic or open the peers' NAT/firewalls. With no relay configured, some pairs of networks will never establish a direct connection. Cellular-to-cellular transfers often need a relay: see [RELAY_SETUP.md](RELAY_SETUP.md).

First try a fresh offer/answer on the same trusted Wi-Fi (avoid guest networks with client isolation). Keep both browser pages open in the foreground; return promptly from the messaging app used for pairing. If appropriate, temporarily disable a personal VPN for this test, or try another network. Do not disable your router/firewall security or open inbound ports blindly. Confirm that the complete answer has been pasted into the original sender session and Connect was tapped. Never reuse pairing text after changing networks or refreshing a page.

In **Settings → Connection diagnostics**, the app shows ICE states and local/remote candidate counts. **Copy diagnostics** copies only those counts/states and numeric STUN error codes and whether TURN is configured; no IP addresses, SDP, credentials, filenames, or transferred text are included. This diagnostic data stays in browser memory and is not uploaded or persistently logged.

- Zero remote routes: check whether the offer/answer was applied.
- Zero STUN-derived public routes: STUN might be disabled, blocked or unavailable. This alone does not prove failure; local or publicly reachable host candidates may still work.
- Routes on both sides but ICE failed: NAT/filtering or a browser interruption can still prevent connectivity. These counts cannot identify the exact network cause.

The root `.env` is loaded through Vite's explicit `envDir`. Use `VITE_STUN_URL=stun:stun.l.google.com:19302` for the documented Google service; an explicitly blank value disables it. Restart the development server after editing `.env`, or rebuild the static site after changing build environment variables. Diagnostics changes in the workspace are not automatically deployed to a separately hosted production site.

Optional TURN integration is prepared but inactive until valid server-side service keys and a private connection code are configured. Merely updating the site or switching language will not enable relay traffic.

`Pairing failed` while creating an offer is a preparation failure, not evidence of a missing answer. Remote candidate counts are expected to be zero at this stage. The failure panel now shows the actual preparation error (for example, network discovery timeout or a browser API error), without the misleading missing-remote-routes hint. If this happens, report the error shown in that panel, the browser/device, and whether failure occurs immediately or after approximately 20 seconds. Do not send the offer/answer itself.
