# Browser interceptor

PakPost Interceptor v0.3.0 is an optional bridge for approved PakPost origins. It is separate from the desktop app, which already has native HTTP transport. Chrome and Edge use the Chromium package; Firefox uses its own manifest (Firefox 128 or newer).

## Chrome and Microsoft Edge

1. Obtain the Chromium ZIP from the downloads page or build it from trusted source using the command below.
2. Extract it into a stable local directory. Open `chrome://extensions` or `edge://extensions` in the browser.
3. Enable Developer mode, choose Load unpacked, and select the folder containing `manifest.json`.
4. Pin PakPost Interceptor, then configure the allowed origin and API destinations as described below.

This is an unpacked developer installation, not a Chrome Web Store or Microsoft Edge Add-ons listing. Browser-managed updates are not provided. Follow your organization's extension policy.

## Firefox

The generated XPI is unsigned. Ordinary Firefox releases require Mozilla signing for permanent installation. Use `about:debugging#/runtime/this-firefox` → Load Temporary Add-on and select the XPI or built `manifest.json` for development. Temporary add-ons are removed on browser restart. Do not disable signature enforcement. A permanent distribution needs a signed XPI or an official Mozilla Add-ons listing; none is verified for this release.

## Configure allowed access

Open the extension popup and add the exact PakPost web origin including scheme and port, e.g. `http://localhost:5173`. Reload the PakPost page. In the interceptor settings choose Specified Destinations (recommended), scan the current PakPost tab, review the detected hosts and grant selected permissions. Allow All is optional and grants broad HTTP/HTTPS host access; enable it only if you understand the scope. Only approved PakPost origins may control the extension. Revocation is available in the popup/browser settings.

Select the browser extension interceptor in the workbench and send a test request. Your browser/device still needs network or VPN access to the target. Redirects are blocked and credentials/cookies are not sent automatically. No extension is needed for desktop native HTTP.

## Build from source

From the repository root (requires Bash and Python 3 for packaging):

```bash
bash extension/release.sh
```

Outputs: `extension/releases/pakpost-interceptor-chrome-v0.3.0.zip`, `extension/releases/pakpost-interceptor-firefox-v0.3.0.xpi`, and `SHA256SUMS`. Check the generated checksums before distributing. The packaging step does not sign or publish an extension to a store.

## Official Cloud domain transition

Open https://app.pakpostapi.com, approve that exact origin in the interceptor popup and reload the workbench. Approval for https://pakpost.duckdns.org is separate. No broad API destination permission is required merely to approve the new workbench origin. Existing extension packages support this without a manifest change.
