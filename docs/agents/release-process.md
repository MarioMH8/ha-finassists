# Release process

## Version

`package.json` owns the product version. `config.yaml` and `custom_components/ha_finassists/manifest.json` repeat it because the Supervisor and HACS read it from their own file, and the MCP server reports it at runtime; `bun run version` (Changesets) writes all of them and `bun run check:version` verifies them in CI. Never edit the version by hand.

## Home Assistant app release

The Home Assistant app repository layout and version are described by `repository.yaml` (repository identity, required by the Supervisor) and `config.yaml` (add-on metadata and version). The Supervisor auto-detects `icon.png` and `logo.png` in the app folder for store artwork. It renders the app's `README.md` as the long description with Home Assistant's Markdown renderer, which does not support raw HTML; keep that file Markdown-only and use absolute image URLs. Brand assets live under `custom_components/ha_finassists/brand/`; both Home Assistant's local brand support and the HACS validator look there for an integration in `custom_components/`.

## App image

The app ships as a prebuilt multi-architecture image instead of being compiled on the user's device. `config.yaml` declares `ghcr.io/mariomh8/ha-finassists`, and the Supervisor always pulls the tag that matches `version`. `.github/workflows/app-image.yml` builds `amd64` on `ubuntu-24.04` and `aarch64` on `ubuntu-24.04-arm`, signs both images and publishes the multi-architecture manifest, tagged with the version and `latest`. Pull requests only build, so a broken `Dockerfile` fails before release; a manual run publishes the current version.

Rules the workflow depends on:

- Push the image for a version before or while that version lands on `main`. Users see the update as soon as `config.yaml` on `main` changes, and cannot download it until the image exists.
- Never publish different content under an existing version tag. Rebuild only when the version changes.
- The first push creates the GitHub Container Registry package. Make it public once in the repository package settings, otherwise users cannot pull it.

Build the image locally from the repository root with `docker build -t ha-finassists .`.
