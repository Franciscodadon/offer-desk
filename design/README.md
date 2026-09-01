# Analyzer UI directions

Source for the analyzer direction mockups, published as a design canvas at
https://claude.ai/code/artifact/6cd3b8ad-55e5-480e-9844-7d50279cc03b

| File | Direction |
| --- | --- |
| `Main.dc.html` | D. Desk - desktop split, inputs left, result rail pinned right |
| `Ledger.dc.html` | A. Ledger - dark underwriting sheet, everything on one screen |
| `Decision.dc.html` | B. Decision - the answer first, inputs as tactile cards |
| `Scenarios.dc.html` | C. Offer ladder - every MAO percentage priced at once |
| `canvas.json` | Layout, titles, and the notes that carry each direction's tradeoff |

All four use the real tokens from `src/theme/` rather than approximations, so
whichever is chosen can be built without redrawing it: emerald `#0E7A57` on the
slate ramp, Archivo / IBM Plex Sans / IBM Plex Mono, 44pt minimum tap targets.

Figures throughout are the PRD 7.6 acceptance case (ARV 357,244, rehab 25,000,
max offer 237,483 at 70%), so the layouts are judged against numbers the
analyzer already produces.

The seeded canvas file is generated and gitignored; these are the sources it is
built from.
