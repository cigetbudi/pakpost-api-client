# Licensing and distribution

PakPost original material is GPL-3.0-only with the attribution/origin terms in
[ADDITIONAL_TERMS.md](../ADDITIONAL_TERMS.md). See [LICENSE](../LICENSE) and
[NOTICE](../NOTICE). Private modifications within one legal entity do not by
themselves require public disclosure; network use alone is not an AGPL-style
source obligation. Conveying copies outside that entity triggers applicable GPL
obligations. Browser bundles conveyed to outside users are also copies.

## Before publishing or replacing release artifacts

- Verify rights to license all original material and review the dependency and
  asset inventory in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
- Build from a known clean commit containing the license and notices. Retain an
  immutable source tag/commit corresponding to the exact binary or bundle.
- For online binary downloads, offer equivalent access to complete corresponding
  source at no additional charge, with clear directions next to the binaries.
  Include build/install scripts and required source for the covered work; a Git
  tag alone is not proof that the source is complete. Verify the exact release
  source archive and that users can obtain it for as long as required by GPLv3.
- Include the GPL text, copyright, section 7 terms and applicable third-party
  licenses/notices in the distributed artifacts or accompanying materials.
- Do not publish actual production `.env`, credentials, signing keys, user data
  or databases. Provide safe example configuration and required build scripts.
- Do not silently replace an existing tag or old binary. Release a new version
  from the licensed source and review previously published artifacts separately.

## Local dependency inventory (run from the repository root)

```sh
(cd frontend && bun install --frozen-lockfile)
(cd desktop && bun install --frozen-lockfile)
dotnet restore backend/Pakpost.slnx
dotnet list backend/Pakpost.slnx package --include-transitive
(cd desktop/src-tauri && cargo metadata --locked --format-version 1 > /tmp/pakpost-cargo-metadata.json)
```

Use resolved npm package metadata and bundled LICENSE/NOTICE files, NuGet package
metadata and license files, and Cargo metadata for all supported targets. Review
license expressions and actual license texts manually; this is not a security
or legal sign-off. Publish no new distribution until the review is complete.
