# Third-party notices — review required before redistribution

PakPost's own code is GPL-3.0-only. Third-party components retain their original
licenses and copyright notices. This file is a scope guide and review record, not a certification of license
compatibility. The collected version-specific texts are available in
`THIRD_PARTY_LICENSES.txt` (desktop and frontend) and
`docs/backend-third-party-licenses.txt` (backend). Both include unresolved
entries and build/test components; do not treat either as a final sign-off.

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

## v0.1.1 evidence scope and open issues

- The desktop/frontend evidence contains the union of the four normal Cargo
  dependency trees and the installed frontend npm inventory. The backend
  evidence contains restored NuGet packages, including test packages.
- Verify upstream candidates against exact source revisions and the actual
  artifact. In particular, selectors 0.38.0 has the standard MPL text only;
  the objc2 family has upstream licensing explanations requiring further
  review; SignalR has the ASP.NET Core release-tag MIT text, but package
  mapping and applicable notices remain to be checked.
- For MPL components, the evidence index provides exact package-version links.
  Verify source completeness and preserve all notices, and supply access to
  the matching source (including any modifications) as required by MPL 2.0.
- Review bundled QuickJS/Emscripten, SQLite, native platform libraries,
  installer bootstrapper materials, original icons/assets, and container
  base images separately. The browser interceptor has its own scope; do not
  assume desktop/backend dependencies are part of the extension.
- Do not publish while relevant evidence gaps or corresponding-source
  obligations remain unresolved.
