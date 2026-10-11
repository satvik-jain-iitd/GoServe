# knowledge/ source

This folder holds the rulebook we follow for GoServe.

**Upstream repository:** https://github.com/satvik-jain-iitd/shipquick_latest
**Branch used:** `dev`
**Commit pinned:** `a33ac9e3e734225c3703dc74b8e0f5807784f364`
**Method:** Git submodule (not a vendored copy), so we can pull upstream changes.
**Submodule path:** `knowledge/shipquick_latest`
**Recorded on:** 2026-10-11

Why a submodule: the owner wants to sync updates from this process repo into GoServe. A submodule keeps one source of truth.

Rule: do not edit files inside the submodule for GoServe-specific needs. GoServe-specific rules live in the root `CLAUDE.md` and in `docs/`. Upstream contributions, if any, are made in the upstream repo itself.
