# Asset Credits and Asset Licences

**This file is the effective licence record for media assets in this project.**

The root [LICENSE](LICENSE) (Apache-2.0) covers **source code only**. Media assets — art, audio, models, textures, fonts, brand marks, and captures — are governed by the licence recorded against them in the tables below, and that record controls over Apache-2.0 for those files.

**Media not listed here is not licensed to you by Apache-2.0.** A missing record means *not yet documented*, not *free to reuse*.

## Redistribution tiers

| Tier | Meaning |
|---|---|
| `Yes` | Public-domain, CC0, MIT, or equivalent media. Commercial and non-commercial redistribution is allowed, with or without credit. |
| `Yes, attribution required` | Redistribution is allowed only while preserving the required credit and licence notice. |
| `With the project only` | Project-created media. It may ship inside a working fork of Fatal Funnel, but may not be extracted, resold, or repackaged as an asset pack. |
| `No, permission required` | Paid, commissioned, or otherwise separately permitted media. Remove or replace it before distributing a fork unless you hold permission. |

## What a fork must remove

Nothing. This snapshot contains no paid, commissioned, or no-redistribution media, so nothing sits in the `No, permission required` tier and no path needed to be excluded from publication on licensing grounds.

Two obligations do travel with a fork:

1. **Keep the radio voice attribution.** The voice pack's training corpus is CC BY 4.0, so the credit line below must survive. It is the only attribution-bearing media in the tree.
2. **Project-created media stays with the project.** The share card, the PWA icons, the first-party surface textures, and the README captures may be forked along with the game but not lifted out of it.

## Inventory scope

The shipped media payload in this snapshot is:

| Group | Path | Files |
|---|---|---|
| Kenney Survival Kit props | `packages/renderer/assets/models/kenney-survival/` | 18 GLB + 1 shared palette PNG |
| Quaternius character bodies | `packages/renderer/assets/models/quaternius-men/` | 3 GLB |
| First-party PBR surfaces | `packages/renderer/assets/textures/` | 6 PNG |
| Gunshot blast layers | `apps/game/public/sfx/` | 6 MP3 (+ 1 generated `manifest.json`) |
| Ambient tension beds | `apps/game/public/bgm/` | 3 MP3 (+ 1 generated `manifest.json`) |
| Squad radio voice pack | `apps/game/public/vo/` | 51 MP3 |
| Project-created images | `apps/game/public/`, `docs/screenshots/` | 5 PNG |

**0 weapon GLB files** ship in this snapshot; the weapon renderer is procedural here.

`PROVENANCE`-style documentation files (`README.md`, `manifest.json`) inside those directories are records, not media payloads, and are excluded from the counts above.

## Models and textures

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `kenney-survival/barrel-open.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `f24ab1c5ab3685fc758f7e7298bf4f255f039fc6dfc7463711fbe90c4c011a41` |
| `kenney-survival/barrel.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `3a0d12f6bdd1badd361f64ce0fbbf878a4ccfc2de8ff1ac4ed4c1aea2a9ee04a` |
| `kenney-survival/box-large.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `69b4052f32b7b27e5d2ee27041b091a07d4a2dd4d877168a701607a97609f0f6` |
| `kenney-survival/box.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `346eebd23986793b992ca6e05e9f98d6f5db96a9bfa3aa7c8360ac8b7920def8` |
| `kenney-survival/bucket.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `ff173908480929067cd634d5edfedba038428f1503db487521492975fa5c8274` |
| `kenney-survival/chest.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `84b03023e425cc1f96c6d0b0f352608be9e8e01b112790e6b00b8651bf84379b` |
| `kenney-survival/colormap.png` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `6ca023be9f12e8c2358fcf94320c8a894b4c05a3dd0bad1f5c268312053caca1` |
| `kenney-survival/fence-fortified.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `c50f420e9ebf0f1383a9f95766d47f377b19852651760b8223219cc2be850ece` |
| `kenney-survival/fence.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `5d8050e39c8b83b5835ea38b9b17429b4a03e289b566a1db771b7e1d9c6e4050` |
| `kenney-survival/metal-panel.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `834d387590b599c68d8b7ef0e35410adbf53f5b5abafc82cd24df04a8d3c03c2` |
| `kenney-survival/resource-planks.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `d3804257474a3baab7ac067be91de5c3d6d18d5803775dc876cb6d9442c30873` |
| `kenney-survival/resource-stone-large.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `6faf73c4998d253f944c0f2372cbd770b2780dd45248221537bf9983d55e0323` |
| `kenney-survival/resource-stone.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `c0ad4ecc890f99dc7c62da067824e31de0f0515de4437e73d8690136bd06e3c0` |
| `kenney-survival/rock-a.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `343bab63ea4c51a5b6c881a9d546f165789cfc26e1f60c517d59e4baa384c82a` |
| `kenney-survival/rock-b.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `f0f4eec72f18722dee56f799c6045953835a91856929dff6fb71331602b12c2e` |
| `kenney-survival/rock-c.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `a0f2e78460acfc4e02e029065472360f2e491c389d6e82f02837e3ed643b9d75` |
| `kenney-survival/structure-metal-wall.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `7577a371dde174ba48b59187f3ce0ed2dd9e20c1cca130f38cecafe2d485f5fb` |
| `kenney-survival/tree-log-small.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `5b416addc4cb01d9d6ad30ec282606a8fefb018043d3253d5e42c1e353aab3c8` |
| `kenney-survival/tree-log.glb` | Kenney | [Survival Kit 2.0](https://kenney.nl/assets/survival-kit) | CC0-1.0 | `Yes` | `bd358e55e63a75bd54bea1e4b40ed362baa937ce8e503f2aa2370a5a1d9da11c` |
| `quaternius-men/casual-character.glb` | Quaternius | [Ultimate Modular Men Pack](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) | CC0-1.0 | `Yes` | `fea7e71271203e7073f1a073fa1208de7402df276f87f80e149bf7589b5d46b4` |
| `quaternius-men/swat.glb` | Quaternius | [Ultimate Modular Men Pack](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) | CC0-1.0 | `Yes` | `a835107bac833eb916c494e10997ae1709e85957ea6f6c59ace3c9a66f6d1fec` |
| `quaternius-men/worker.glb` | Quaternius | [Ultimate Modular Men Pack](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) | CC0-1.0 | `Yes` | `9c28614f465b7dc105f908c20c22fc045f4b07caf8c5ef0e9f8049eceb6dd38d` |

Model paths above are relative to `packages/renderer/assets/models/`. Archived licence text for both packs: `LICENSES/kenney-survival-kit-2.0-CC0.txt` and `LICENSES/CC0-1.0.txt`.

### First-party PBR surfaces

These are **not** third-party assets. They are deterministic output from the owner's local `houseproc` texture generator — no machine-learning model, hosted generator, downloaded source image, or network service was involved. They are recorded here because a complete register has to distinguish first-party generated files from sourced ones.

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `textures/cqb-floor_albedo.png` | Project | local `houseproc` generator | Project-created | `With the project only` | `af91539b5e1cd0331c3d743d14e7ded8118eb143b438ae9749c6a1c70753ab33` |
| `textures/cqb-floor_normal.png` | Project | local `houseproc` generator | Project-created | `With the project only` | `7b314f2548985225318172daebcf4650b5ded4b23f492d9aa5fbe601094b4905` |
| `textures/cqb-floor_rough.png` | Project | local `houseproc` generator | Project-created | `With the project only` | `2cd667681fe7b233b96104d14565f388f893cd650f1b36ffbf45299632f5916f` |
| `textures/cqb-wall_albedo.png` | Project | local `houseproc` generator | Project-created | `With the project only` | `d65246f621431df739461e466ac4aac1c1f6f263efc8f0a624bdd7c0af95893e` |
| `textures/cqb-wall_normal.png` | Project | local `houseproc` generator | Project-created | `With the project only` | `05eca6dbbab9d974d7a8c180dafa6716742a5fadd97180c7290de0cc60931f92` |
| `textures/cqb-wall_rough.png` | Project | local `houseproc` generator | Project-created | `With the project only` | `1ac6fd63b9e972b213c1a04a114ee438f038334d88141443dac0ea058b8ddc42` |

Texture paths are relative to `packages/renderer/assets/`.

> **Record gap, stated rather than hidden.** `packages/renderer/assets/textures/ASSETFORGE-LICENSES.txt` enumerates only the three `cqb-wall_*` files. All six files are covered by [`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md) and by the table above; the generator manifest is the incomplete document, and the six digests in this table were re-measured against the shipped files.

## Audio

### Gunshot blast layers — `apps/game/public/sfx/`

The shipped files are the blast layer only; the per-weapon crack, mechanical action, and tail are synthesised at play time, and if the pack fails to load the engine falls back to pure synthesis.

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `rifle_556.mp3` | Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | CC0-1.0 | `Yes` | `2eb88ec445f9f16aa1390c31c55022be09a066b7c7de733c0401b09c23fa01ad` |
| `rifle_762.mp3` | as above | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | CC0-1.0 | `Yes` | `fe6666832d7e4ae52bdb23565181a077e7afb763e9ca06ad24c18b4a58ff91a2` |
| `pistol_9mm.mp3` | as above | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | CC0-1.0 | `Yes` | `9c21d987d1d8622441a8af64b949d55f7867bf70b652a9c0f81fa6024288d304` |
| `smg_9mm.mp3` | as above | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | CC0-1.0 | `Yes` | `e653d95a467177a0e6c8de2f2b682538889b5873bbb9dc06cfca5e99f6231d04` |
| `shotgun_12ga.mp3` | as above | [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | CC0-1.0 | `Yes` | `2deb32f2270dda854a8fd2f421855c896601577d9c8d64c0c602bdd26752187e` |
| `suppressed.mp3` | areniporgen | [Freesound 828790](https://freesound.org/people/areniporgen/sounds/828790/) | CC0-1.0 | `Yes` | `92d0224f8a773a668000b99047234fd638d8f2b06ca97abb3e5d0d323243ce2e` |

Archived licence pages: `LICENSES/opengameart-free-firearm-sound-library.html`, `LICENSES/freesound-828790.html`.

CC0 waives attribution, so none is owed. The library's authors ask for credit anyway and the game gives it:

> *Gunfire recordings by Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney (The Free Firearm Sound Library, CC0), and by areniporgen (CC0).*

### Ambient tension beds — `apps/game/public/bgm/`

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `bed_quiet.mp3` | bassimat | [Freesound 854836](https://freesound.org/people/bassimat/sounds/854836/) | CC0-1.0 | `Yes` | `b30b061f2f93aefec872ed32d37b2d17971b5fba2aa7b7a97abc0cfd4d4a0094` |
| `bed_tension.mp3` | bassimat | [Freesound 860781](https://freesound.org/people/bassimat/sounds/860781/) | CC0-1.0 | `Yes` | `209277d6308d1d4f504c94b24f06876075136d2c029ce5fc40f3dc0a1d431fa7` |
| `bed_contact.mp3` | pryanic | [Freesound 779184](https://freesound.org/people/pryanic/sounds/779184/) | CC0-1.0 | `Yes` | `2c1071ea4302e21c3cae89371b04bf0da521a1da06693711296e0241a6f93c8a` |

Archived licence pages: `LICENSES/freesound-854836.html`, `LICENSES/freesound-860781.html`, `LICENSES/freesound-779184.html`. Attribution is not required; the game credits *Ambient beds by bassimat and pryanic (CC0)* anyway.

### Squad radio voice pack — `apps/game/public/vo/`

**51 MP3 files across 7 event kinds** (`breaching`, `clear`, `contact`, `friendly-down`, `reloading`, `stack-up`, `target-down`), rendered locally by `node tools/voicegen.mjs` and run through a radio chain. Nothing from the synthesis toolchain is redistributed — the tool is run offline the way a compiler is.

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `vo/*.mp3` (51 files) | rendered by this project using Piper | engine [Piper](https://github.com/rhasspy/piper) (MIT); voice `en_US-libritts-high` (MIT); corpus [LibriTTS](http://www.openslr.org/60/) (CC BY 4.0) | CC BY 4.0 (corpus terms flow through) | `Yes, attribution required` | not hashed — see note |
| `en_US-libritts-high.onnx` (build input, **not shipped**) | rhasspy | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) | MIT | not redistributed | `9127a559e11603f10b366d1a20ac7426826081dbc521de4c2420c57728d73f0f` |
| `en_US-libritts-high.onnx.json` (build input, **not shipped**) | rhasspy | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) | MIT | not redistributed | `2efdc6d7f954588b8180132cbd9b8001933fdd00932c92bc92fd0d2028a9eb3d` |

**Why the clips are not hashed.** Piper's decoder is stochastic, so a re-render is equivalent but not byte-identical. Hashing 51 outputs would produce a ledger that fails for a legitimate re-render, so the *input* the licence attaches to is hashed instead. This is the ledger's deliberate choice, preserved here.

Required credit, because CC BY 4.0 does not waive it:

> *Squad radio voices synthesised with Piper (MIT), using a voice trained on the LibriTTS corpus (Zen et al., 2019) — CC BY 4.0.*

Archived evidence: `LICENSES/piper-MIT.txt`, `LICENSES/openslr-60-libritts.html`, `LICENSES/CC-BY-4.0.txt`, `LICENSES/piper-voices-en_US-libritts-high-MODEL_CARD.txt`, `LICENSES/piper-tts-GPL-3.0-COPYING.txt`.

> **Record gap, stated rather than hidden.** `apps/game/public/vo/README.md` still describes the pack as "42 clips: 6 event kinds". The measured contents of this snapshot are **51 clips across 7 event kinds**; the count in that README is stale, the file inventory is authoritative, and the licence position it documents is unchanged.

## Fonts and brand marks

No third-party font files or brand marks ship in this snapshot. The interface uses the platform monospace stack (`SF Mono`, `ui-monospace`, `Menlo`) by name, which references locally installed fonts rather than redistributing any.

## Project-created images

| Asset | Author | Source | Licence | Redistribution | SHA-256 |
|---|---|---|---|---|---|
| `apps/game/public/og.png` | Project | `node tools/og-shot.mjs` — a real captured frame of the running build | Project-created | `With the project only` | `6fdd9f5acd6b93e5afc3ada7b0f934cd84f98e2771cebedd3a7771040fc95c37` |
| `apps/game/public/icon-192.png` | Project | raster of the project's inline SVG mark in `apps/game/index.html` | Project-created | `With the project only` | `5e3ce444289d56dc34b6bb3afebc0dda193b7a18d0036ec13f1ce069a03a6bbd` |
| `apps/game/public/icon-512.png` | Project | raster of the project's inline SVG mark in `apps/game/index.html` | Project-created | `With the project only` | `99e713afb1501a1e6e5267745a2d5a1cfd51e6b0ee7a0ff34fdc145249786b0d` |
| `docs/screenshots/fog-of-war.png` | Project | `node tools/shots.mjs` → `fog` camera | Project-created capture | `With the project only` | `c38a19959eb7c7ac18103da4dfb2e03b5fa33bb73fbede634981728816f4c715` |
| `docs/screenshots/insertion.png` | Project | `node tools/shots.mjs` → `tac` camera | Project-created capture | `With the project only` | `e482b50c58e444ed1cfd40dabb46de5c1c1a293c09d4e367020bf0e90fc152f2` |

Runtime geometry, materials, VFX, and synthesised audio are generated at play time from code in `packages/renderer/` and `apps/game/src/`; they are covered by the same `With the project only` tier and have no file digest.

## Preserved provenance records

These in-repo documents are promoted, not replaced. Where they disagree with this file on a **count**, the measured inventory above is authoritative; where they carry **evidence** (archived pages, download artefacts, rejection reasoning), they are the primary record.

- [`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md) — per-file provenance, acquisition dates, download-artefact digests, and the full list of assets rejected on licence or model-lineage grounds.
- [`apps/game/public/THIRD_PARTY_NOTICES.txt`](apps/game/public/THIRD_PARTY_NOTICES.txt) — the distribution-facing notice shipped inside the build; `tools/bundle-check.mjs` fails a build that does not copy it into `dist/`.
- `LICENSES/` — 12 archived licence pages and licence texts, captured at acquisition time because a live URL can be edited after you read it.
- [`packages/renderer/assets/models/README.md`](packages/renderer/assets/models/README.md) — the intake contract for owner-supplied models.
- [`apps/game/public/vo/README.md`](apps/game/public/vo/README.md) — how the radio pack is rendered, and the quoted model and corpus grants.
