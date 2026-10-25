# Release process

The repository currently defines no automated release, package publication, or versioning workflow. The app version is declared in `config.yaml` and the package manifest; keep them aligned when preparing a Home Assistant app release.

## Home Assistant app release

The Home Assistant app repository layout and version are described by `repository.yaml` (repository identity, required by the Supervisor) and `config.yaml` (add-on metadata and version). The Supervisor auto-detects `icon.png` and `logo.png` in the app folder for store artwork. It renders the app's `README.md` as the long description with Home Assistant's Markdown renderer, which does not support raw HTML; keep that file Markdown-only and use absolute image URLs. Brand assets live under `custom_components/ha_finassists/brand/`; both Home Assistant's local brand support and the HACS validator look there for an integration in `custom_components/`. No GitHub release workflow or release branch policy is configured yet. Document additional release steps here when the repository adopts them.
