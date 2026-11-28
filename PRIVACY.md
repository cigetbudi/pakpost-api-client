# Privacy by design

**Your APIs. Your data. Your control.**

PakPost is an open-source API client designed for local work and optional collaboration. Our product commitments are no product telemetry, no behavioral tracking, no usage analytics, no hidden AI agents, and no mandatory cloud account. These commitments describe PakPost's intended behavior, not a claim about every operating system, browser, service provider or future release.

## Local mode

The desktop app supports creating and editing requests, collections and environments without signing in. Local data can include request history, headers, bodies, scripts, environment values and workspace preferences. Desktop workbench data is persisted locally (including SQLite); the web app uses browser storage. Local storage is not a guarantee of encryption at rest or protection against other software with access to the device. Treat exported collections, backups and history as potentially sensitive.

A request you explicitly send goes to its chosen destination using the configured transport. API endpoints, DNS resolvers, proxies and other network infrastructure may process or log that traffic. Local editing does not require a PakPost cloud account. The hosted web app must first load its assets from the hosting server; it is not equivalent to an offline desktop executable.

## Cloud and self-hosted modes

Cloud collaboration connects to the selected PakPost server for authentication, workspace data, permissions, and realtime updates. Collection and environment data saved to a remote workspace is stored on that server. Workspace encryption at rest is not end-to-end encryption: an authorized server can decrypt the data it needs to serve. A self-hosted operator controls its infrastructure, storage, backups and retention.

Google sign-in is optional for local use and required for the current Google-based cloud sign-in flow. The identity provider processes authentication data, and profile images may be retrieved from Google. The desktop sign-in flow can open an external browser. That browser and its extensions have separate privacy behavior. Invitations may use an email provider. These are functional service connections, not exemptions from the product's privacy commitments.

## Logging and other services

Operational server logs may record request metadata such as routes, status and duration. Such logs differ from product usage analytics. Retention and access depend on deployment configuration; this document does not promise a specific deletion interval. Browser interceptors, user-selected proxies, API targets and external services have their own permissions and policies. Review them before transmitting secrets. Third-party operating system and browser traffic is outside the app's direct control.

## Verification and transparency

The repository includes targeted dependency and external-font checks, browser outbound network regression checks, and an optional Linux desktop network check. See [privacy testing](docs/privacy-testing.md). The initial Linux checks observed no direct external IP connections in the tested production local-mode session; the final cloud-mode connection trace showed the configured PakPost server and DNS resolver. These are scoped observations, not proof of all behavior. Earlier cloud traces contained destinations not conclusively attributed; browser sign-in, backend logging, website, extensions, Windows and macOS require separate verification.

Privacy-related changes should be reviewed before release. Update checks, if introduced, must be documented separately with their network destination and data handling. Report suspected unexpected network activity through the [project issue tracker](https://github.com/cigetbudi/pakpost-api-client/issues), using sanitized reproduction steps rather than credentials, private endpoints or raw request data.

## Optional desktop updates

Checking for software updates is initiated manually in Settings → About.
The desktop client contacts the official public GitHub release endpoint and,
if the user installs an update, downloads the signed installer. GitHub receives
normal network metadata (such as IP address); PakPost does not attach workspace
data or account credentials. There is no automatic startup check.
