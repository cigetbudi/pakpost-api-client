# Third-party notices — review required before redistribution

PakPost's own code is GPL-3.0-only. Third-party components retain their original
licenses and copyright notices. This file is a preliminary inventory of direct
components observed in the project manifests, not a complete notice bundle or a
certification of license compatibility.

| Area | Components to review |
| --- | --- |
| Frontend | React, React DOM, Zustand, CodeMirror, UIW, QuickJS/Emscripten, CryptoJS, Microsoft SignalR, Lucide, Prettier, Tauri API |
| Build/test | Bun, Vite, Tailwind CSS, Playwright, Tauri CLI, associated plugins |
| Backend | Mediator, FluentValidation, EF Core, Npgsql, Google.Apis.Auth, Microsoft.Extensions, IdentityModel |
| Desktop | Tauri, serde, log, rusqlite/SQLite, reqwest, base64, tokio, futures-util, tokio-tungstenite, keyring and native platform dependencies |
| Extension | Browser-specific APIs, bundled icons and other assets |
| Containers | .NET runtime/SDK, Node distroless, Bun builder, Caddy and OS packages |

## Release review

1. Resolve exact dependency versions from Bun and Cargo lockfiles and restored
   NuGet assets. Include transitives, target-specific native dependencies and
   bundled assets/fonts. Check upstream license texts at those exact versions.
2. Confirm compatibility with GPLv3 for each combined distribution; record SPDX
   identifiers, copyright, exceptions and license/NOTICE texts. Preserve Apache
   NOTICE obligations where applicable, and review LGPL and other copyleft terms.
3. Bundle the required third-party notices and license texts with each relevant
   installer, extension and image. Review sources or source offers required by
   third-party terms separately. Do not treat this inventory as a substitute.
4. Verify ownership or permission for all original contributions and branding.

See [release licensing](docs/release-licensing.md) for the release checklist.
