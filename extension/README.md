# Pakpost Interceptor Extension (v0.1.0)

Native browser extension for Pakpost, using Manifest V3 and no external dependencies. Chrome/Edge and Firefox builds use the same core code with separate manifests.

## Build

```bash
bash extension/build.sh
```

The build outputs are `extension/dist/chrome/` and `extension/dist/firefox/`.

## Chrome / Edge (unpacked development install)

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode, then click **Load unpacked**.
3. Select the **extracted** `extension/dist/chrome` directory containing `manifest.json`.
4. Pin **Pakpost Interceptor** to the toolbar, open its popup.
5. Add your Pakpost web origin (example `http://localhost:5173`) to **Allowed Pakpost Origins**. Accept the browser permission prompt.
6. Click **Scan this Pakpost tab** in the extension popup. Review all detected API destinations, optionally deselect any, then **Grant selected destinations** once. The browser may ask permission for the set. Alternatively paste multiple full URLs in **Or paste multiple URLs** and review them.
7. Reload the Pakpost web tab.
8. In Pakpost, go to **Settings → Interceptor → Browser Extension → Check connection**. It should show Connected.
9. In the workbench, Send as usual. QuickJS pre/post scripts and environment variables remain in Pakpost.

## Firefox (temporary development install)

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `extension/dist/firefox/manifest.json`.
4. Configure the popup the same way as Chrome (Scan / Review / Grant).
5. Reload Pakpost and check connection in Settings.

Firefox temporary add-ons are removed when Firefox is restarted. For permanent installation, sign/distribute an XPI through an appropriate Mozilla Add-ons / enterprise process.

## Config examples

Use exact **origins** in the popup, not endpoint paths:

- Pakpost web origin: `http://localhost:5173` or `https://pakpost.example.com`.
- API destination: `https://api.dev.example.com` or `http://10.0.1.5:8080`.

The extension discovers host origins, not individual endpoint paths. Several endpoints on one host only require one entry. You can also paste newline/comma separated URLs for bulk import. Each entry may be removed later. The browser may grant host permissions for all ports at a given host; Pakpost **still checks the full exact origin, including port**, for every request.

The browser must already have LAN/VPN/DNS/TLS access to the destination. Installing the extension does not establish a VPN or trust a self-signed certificate.

## v27.1: one-click host discovery

- After authorizing the current Pakpost site and reloading it, open the extension popup while on Pakpost and click **Scan this Pakpost tab**.
- The webpage supplies only deduplicated `http(s)://host[:port]` origins from loaded requests and environment URL values (never secrets, request paths or response bodies). Only loaded Neon request lists are scanned.
- Review the list, deselect any unwanted destinations, and press **Grant selected destinations**. Permissions are requested together from the browser. Nothing is allowed automatically.
- Alternatively paste several full URLs with newline/comma separators into **Or paste multiple URLs** and review. Paths are stripped; only origins are stored.
- Chrome/Firefox may prompt differently; approval is always controlled by the browser and may require accepting a permission dialog.
- Limit is 32 approved destination origins.

## Safety model

- **No install-time wildcard host access:** `optional_host_permissions` are only requested on explicit Add clicks.
- **Two separate allowlists:** approved Pakpost websites (allowed to invoke the extension) vs approved API destinations.
- **Every request is checked in the background:** extension sender URL, top-level tab origin, browser permission, destination origin and HTTP method.
- **Privacy:** requests are sent from the browser extension, not forwarded to Pakpost's backend; `credentials: 'omit'` means cookies and ambient credentials are not attached automatically.
- **No auto-follow redirects**, no browser-proxy fallback, timeout 20 seconds, max four concurrent sends per Pakpost origin.
- Response preview is capped at 1 MiB. Raw request bodies are capped at 128 KiB; multipart and binary at 5 MiB.
- Blocked request headers include Host, Cookie, Origin, Referer and proxy hop-by-hop headers. Explicit Authorization is supported.
- Nothing is uploaded to a third-party service by the extension itself. Configuration stores only origin strings in extension-local storage.
- Do **not** authorize untrusted Pakpost website origins: an authorized website can make calls to every API destination you grant it.
- You may need an administrator's permission to use extensions or access internal APIs on corporate devices.

## Troubleshooting

- **Not connected:** approve the exact Pakpost website origin, grant permission and **reload the tab**. Then Check connection.
- **Destination not allowed:** add the API's scheme+host+port origin in the popup.
- **No VPN/DNS/TLS:** extension cannot make unreachable internal endpoints reachable. Check browser address bar/certificate trust and corporate network policies.
- **Redirect blocked:** request the target URL directly and allow its origin first.
- **Extension updated/reloaded:** reload the Pakpost webpage to reattach the content script.

## Known limitations

- Not a Chrome Web Store / AMO published package. Use unpacked/temporary installs for development testing only.
- Browser extension cross-origin access still depends on browser/corporate security policies. It is not a general bypass for network access restrictions.
- Headers forbidden by the browser cannot be set, and redirects are intentionally blocked.
- Local Agent and arbitrary third-party proxy URLs are not implemented in v27.
