# Color Link — Game Design & Implementation Spec

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Version         | v1.0                                                                                              |
| Date            | 2026-08-27                                                                                        |
| Status          | Draft                                                                                             |
| Genre           | Grid path-connection logic puzzle (Flow-style)                                                    |
| Platform        | Web (mobile-first, responsive to desktop); installable PWA is a stretch goal                      |
| Stack           | TypeScript (strict), Vite, HTML5 Canvas for the board, plain DOM for all chrome, Vitest for tests |
| Estimated build | 1 Claude Code session for MVP (phases 0–5 in section 17)                                          |

Reference: "Color Link" mode in the mobile app _Numpuz_. This spec re-implements the core mechanic, keeps the tier/level structure, removes all monetisation and decoration, restyles the UI in the spirit of the New York Times Games apps (white, typographic, minimal), and extends the difficulty ladder with two new tiers, **Expert** and **Master**, placed after **Extreme**.

---

## 1. Elevator pitch

An N×N grid holds pairs of coloured dots. You drag a line from one dot to its twin, cell by cell, and no two lines may cross or share a cell. The puzzle is solved when every pair is joined **and** every cell on the board is covered. The "aha" is realising that the empty cells are the real constraint: you are not routing lines, you are tiling the board with them. Six tiers from a 5×5 warm-up to a 14×14 Master board, 100 levels each, generated deterministically so every player gets the same level 42.

## 2. Assumptions

Tob confirms or overrides each of these. Anything marked _(config)_ can be changed by editing a single constant in `src/generator/difficulty.ts` or `src/app/config.ts` without touching logic.

1. **Tier ladder** is Easy 5×5, Normal 6×6, Hard 8×8, Extreme 10×10, Expert 12×12, Master 14×14 — in that order of increasing difficulty. Numpuz's "Hell" tier is dropped. The ladder is a config array; adding "Hell" back as a 7th tier is one entry. _(config)_
2. Numpuz does not reveal Extreme's board size (it is locked in the screenshots); 10×10 is chosen so that each tier grows by ≥2 cells per side. _(config)_
3. **100 levels per tier**, matching the original. _(config)_
4. **Win condition requires 100% cell coverage**, not merely all pairs connected. The original displays a "coverage rate" and the reference genre (Flow Free) requires a full board. This also gives a clean solvability guarantee (section 7.1).
5. **Drawing over another colour's line cuts that line back** to the cell before the collision (Flow Free behaviour) rather than blocking the pointer. This is better on touch and still enforces "lines never intersect" in any resting state.
6. **Levels are procedurally generated at runtime from a deterministic seed** derived from `(generatorVersion, tierId, levelIndex)`. No level JSON is shipped. Same level for every player, every device, forever (until `GENERATOR_VERSION` is bumped).
7. **Tier unlocks** mirror the original: Easy, Normal and Hard are always open; Extreme unlocks after 20 Hard levels solved; Expert after 20 Extreme; Master after 20 Expert. _(config)_
8. **Within a tier all 100 levels are playable in any order** (no sequential lock). The level grid highlights the first unsolved level as the suggested next one. This departs from the original's sequential unlock in favour of NYT-style freedom.
9. **No coins, ads, hint economy, stars, or share-to-earn**. Hints are unlimited; a level solved with a hint is recorded as such and displayed with a hollow marker instead of a solid one.
10. **No lose condition.** The timer counts up and is informational only.
11. **Board rendering uses Canvas**; every other screen is plain DOM + CSS. No game engine, no UI framework.
12. **Sound defaults to on**, synthesised with the Web Audio API (no audio files). Haptics default to on where `navigator.vibrate` exists.
13. **No backend, no analytics, no network requests after initial load.**
14. Working title is "Color Link" (US spelling, matching the reference). The display name lives in one constant (`APP_NAME`) for later renaming. _(config)_
15. Languages: English UI only for MVP; all user-facing strings live in one `strings.ts` file to make French a later drop-in.

## 3. Player experience

- **Session length**: 20 s (Easy) to 5–10 min (Master) per level. A play session is typically 3–10 levels. Nothing interrupts play; there are no popups except the solved card.
- **Difficulty curve**: two axes. _Across tiers_, board size grows (5→14). _Within a tier_, level 1 uses the most pairs (short, obvious paths) and level 100 the fewest (long, winding paths); the generator also requires progressively more bends per path. Concretely, "hard" means fewer, longer lines that must snake around each other to cover the board.
- **Emotional target**: calm and clever. Quiet feedback, no shaking, no confetti; a short, satisfying solve animation and a clean results card.
- **Reference games and what is borrowed**:
  - _Numpuz – Color Link_: the mechanic, the tier/level structure, the "lines x/y" and coverage HUD, tier unlock thresholds.
  - _Flow Free_: exact drag semantics (start from an endpoint, cut other lines, backtrack), cell tint under paths, full-coverage rule.
  - _NYT Games (Wordle, Connections, Strands)_: visual language — white background, black text, serif headline, thin rules, pill buttons, single accent, results card with time, dark mode.

## 4. Core loop

1. Launch → Home shows the six tiers with progress (e.g. "Hard · 8×8 · 23/100"). Locked tiers show what unlocks them.
2. Tap a tier → level grid (100 tiles). The first unsolved level is highlighted.
3. Tap a level → board appears; timer starts on first pointer-down.
4. Drag from a dot to its twin; repeat for every colour, using undo/restart/hint as needed.
5. When all pairs are connected and every cell is filled, the board locks, the solve animation plays, and the results card shows time, best time, and a "Perfect" badge if no hint was used and each colour was drawn exactly once.
6. Tap "Next level" → next level in the same tier (or the level grid if 100 was just solved).
7. Progress and the current in-progress board are saved to localStorage on every state change, so closing the app mid-level and reopening resumes exactly where the player left off.

## 5. Rules (formal)

### 5.1 Board / world

| Element       | Definition                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board         | Square grid of `size × size` cells, `size ∈ {5, 6, 8, 10, 12, 14}`. Cell coordinates `[row, col]`, 0-based, row 0 at top.                                                                                                       |
| Cell          | Exactly one of: empty; occupied by colour `c`. Occupancy is derived from paths.                                                                                                                                                 |
| Endpoint      | A cell permanently marked with colour `c`. Each colour has exactly two endpoints, `a` and `b`. Endpoints are always occupied by their own colour (an endpoint with no path still counts as occupied by `c` for coverage).       |
| Colour        | Integer `0 ≤ c < K`, `K` = number of pairs in the level, `K ≤ 16` (palette size).                                                                                                                                               |
| Path          | Ordered list of cells for colour `c`. Either empty, or begins at one of `c`'s endpoints and consists of orthogonally adjacent, pairwise-distinct cells. A path is **complete** when its last cell is the other endpoint of `c`. |
| Adjacency     | Orthogonal only (up/down/left/right). No diagonals, no wrapping.                                                                                                                                                                |
| Initial state | All paths empty. Occupancy = endpoint cells only. Timer = 0, moves = 0, hintUsed = false.                                                                                                                                       |

### 5.2 Legal moves

All interaction is a **stroke**: pointer-down (`begin`), zero or more pointer-moves (`extend`), pointer-up (`end`). The engine exposes exactly these operations plus `undo`, `restart`, `hint`. `head(c)` = last cell of `paths[c]`.

| Operation                                                             | Precondition                           | Effect                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `begin(cell)` — cell is an endpoint of colour `c`                     | —                                      | `paths[c] = [cell]` (any previous path of `c`, complete or not, is discarded). Stroke becomes active for `c`.                                                                                                                                                                                                                         |
| `begin(cell)` — cell is occupied by colour `c` but is not an endpoint | —                                      | `paths[c]` truncated to end at `cell` (inclusive). Stroke active for `c`.                                                                                                                                                                                                                                                             |
| `begin(cell)` — cell empty                                            | —                                      | No effect; no active stroke.                                                                                                                                                                                                                                                                                                          |
| `extend(cell)` — no active stroke                                     | —                                      | No effect.                                                                                                                                                                                                                                                                                                                            |
| `extend(cell)` — `cell == head(c)`                                    | active stroke                          | No effect.                                                                                                                                                                                                                                                                                                                            |
| `extend(cell)` — `paths[c]` is complete                               | active stroke                          | No effect (a complete path cannot be extended; the player must `begin` again to redraw).                                                                                                                                                                                                                                              |
| `extend(cell)` — cell not orthogonally adjacent to `head(c)`          | active stroke                          | If `cell` shares a row or column with `head(c)`, apply `extend` to each intermediate cell in order, stopping at the first one that has no effect. Otherwise no effect. (Handles fast pointer movement that skips cells.)                                                                                                              |
| `extend(cell)` — cell already in `paths[c]`                           | active stroke                          | Backtrack: `paths[c]` truncated to end at `cell` (inclusive).                                                                                                                                                                                                                                                                         |
| `extend(cell)` — cell is an endpoint of colour `d ≠ c`                | active stroke                          | No effect (blocked).                                                                                                                                                                                                                                                                                                                  |
| `extend(cell)` — cell is the other endpoint of `c`                    | active stroke                          | Append `cell`. Path is now complete. Emit `pathCompleted(c)`.                                                                                                                                                                                                                                                                         |
| `extend(cell)` — cell occupied by colour `d ≠ c` (non-endpoint)       | active stroke                          | Cut: `paths[d]` truncated to end at the cell _before_ `cell` (so `cell` and everything after it are removed from `d`). Then append `cell` to `paths[c]`.                                                                                                                                                                              |
| `extend(cell)` — cell empty                                           | active stroke                          | Append `cell`.                                                                                                                                                                                                                                                                                                                        |
| `end()`                                                               | —                                      | Stroke inactive. If the board differs from the snapshot taken at `begin`, push that snapshot onto the undo stack and `moves += 1`.                                                                                                                                                                                                    |
| `undo()`                                                              | undo stack non-empty, no active stroke | Restore the top snapshot (all paths). Timer unaffected.                                                                                                                                                                                                                                                                               |
| `restart()`                                                           | no active stroke                       | All paths empty, undo stack cleared, `moves = 0`. Timer keeps running (it is per-attempt, not per-board). `hintUsed` unchanged.                                                                                                                                                                                                       |
| `hint()`                                                              | no active stroke, level not won        | Let `c` = lowest colour index whose current path, as a set of cells, differs from `solution[c]`. Set `paths[c] = solution[c]`, cutting any other path that occupies a cell of `solution[c]` (same cut rule as `extend`). Push undo snapshot, `moves += 1`, `hintUsed = true`. If no such `c` exists the level is already won (no-op). |

Invariants that must hold after every operation (asserted in tests):

- Every non-empty `paths[c]` starts at an endpoint of `c` and is a chain of distinct orthogonally adjacent cells.
- No cell belongs to two paths.
- No path contains an endpoint of another colour.

### 5.3 Win condition

`won == (every colour c has a complete path) AND (occupiedCells == size × size)`.

Evaluated after every state mutation (including mid-stroke, since the final cell can be filled while dragging). When it becomes true: the active stroke is force-ended, the timer stops, and the state machine transitions `Playing → Won`. The elapsed time recorded is the time at which the condition became true, not at pointer-up.

### 5.4 Lose / fail condition

N/A — there is no lose state. No move limits, no countdown. The timer is informational.

### 5.5 Edge cases

- **Coverage display**: `coverage = occupiedCells / (size × size)`, where endpoints always count as occupied. Displayed as an integer percentage, rounded down.
- **Lines counter**: number of complete paths. A complete path that is later cut is no longer complete.
- **Pointer leaves the board**: treated as moving to no cell; the stroke stays active and resumes when the pointer re-enters, subject to the adjacency/interpolation rules.
- **Pointer cancel** (browser gesture, incoming call): treated as `end()`.
- **Multi-touch**: only the first active `pointerId` is tracked; other pointers are ignored until it ends.
- **Undo during stroke**: not allowed; the toolbar is inert while a stroke is active.
- **Undo depth**: unlimited within a level; the stack is cleared on restart and on leaving the level.
- **Resize / rotation**: board re-lays out; state unchanged.
- **Tab hidden / app backgrounded**: `Playing → Paused` automatically; timer stops.
- **Hint on a level with all pairs connected but coverage < 100%**: by definition at least one path differs from its solution, so `hint()` always makes progress.
- **Last level of a tier solved**: "Next level" returns to the level grid.
- **Tier unlock**: evaluated on every level completion; newly unlocked tiers appear unlocked the next time Home is shown (no interstitial).
- **Reset progress**: clears all three storage keys after a confirm dialog; the app returns to Home.

## 6. Game state machine

Two orthogonal layers: a **screen** (exactly one) and an optional **modal** overlaid on it.

```
Screens:
  Boot ──(storage loaded)──▶ Home
  Home ──(tap tier, unlocked)──▶ LevelSelect(tier)
  LevelSelect ──(tap level)──▶ Playing(level)
  LevelSelect ──(back)──▶ Home
  Playing ──(won == true)──▶ Won(level, result)
  Playing ──(back)──▶ LevelSelect          (in-progress board is saved)
  Won ──(next)──▶ Playing(level+1)  |  ──(next on level 100)──▶ LevelSelect
  Won ──(replay)──▶ Playing(same level, fresh)
  Won ──(levels)──▶ LevelSelect
  Boot ──(inProgress level found)──▶ Playing(restored)   (resume; overrides Home)

Modals (any screen unless noted):
  Settings, HowToPlay, ConfirmReset
  Paused — only over Playing; triggers: pause button, Escape, visibilitychange→hidden
  Paused ──(resume / visible again + tap)──▶ Playing
```

| Trigger            | From              | To               | Side effects                                                                                    |
| ------------------ | ----------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| Level loaded       | LevelSelect / Won | Playing          | generate or restore level; timer at 0 or restored; timer does **not** start until first `begin` |
| First `begin`      | Playing           | Playing          | timer starts                                                                                    |
| `won` becomes true | Playing           | Won              | stop timer; persist result; play solve animation, then show card                                |
| Pause              | Playing           | Playing + Paused | stop timer; board is hidden behind the modal (prevents timer cheating, matches NYT)             |
| Resume             | Paused            | Playing          | timer resumes                                                                                   |

## 7. Levels & content

### 7.1 Source

**Procedural, deterministic, generated on demand at level load.** No level data is shipped.

**Seed**: `seed = fnv1a32("v" + GENERATOR_VERSION + "|" + tierId + "|" + levelIndex)`. `GENERATOR_VERSION` is an integer constant; bumping it changes every level and must be accompanied by a changelog entry. PRNG is `mulberry32(seed)`; every random decision in the generator draws from this PRNG and nowhere else (`Math.random` is forbidden in `src/generator/**`, enforced by a unit test that greps the source).

**Solvability guarantee**: the generator first builds a full partition of the board into paths (a complete solution), then derives the puzzle by keeping only each path's two end cells as endpoints. A solution therefore exists by construction and covers 100% of the board. The solution is retained in the level object for the hint feature. Uniqueness of solution is **not** guaranteed in MVP; the win check accepts any valid full-coverage solution, so non-uniqueness is never a correctness bug.

**Difficulty parameters** (`src/generator/difficulty.ts`) — `t = (levelIndex − 1) / 99` is the position within the tier:

| Tier    | id        | Board | Pairs at L1 → L100 (linear in t, rounded) | Min avg bends/path at L1 → L100 | Unlock            |
| ------- | --------- | ----- | ----------------------------------------- | ------------------------------- | ----------------- |
| Easy    | `easy`    | 5×5   | 6 → 4                                     | 0.5 → 1.5                       | always            |
| Normal  | `normal`  | 6×6   | 7 → 5                                     | 0.8 → 2.0                       | always            |
| Hard    | `hard`    | 8×8   | 9 → 6                                     | 1.0 → 2.5                       | always            |
| Extreme | `extreme` | 10×10 | 12 → 8                                    | 1.2 → 3.0                       | 20 Hard solved    |
| Expert  | `expert`  | 12×12 | 14 → 10                                   | 1.5 → 3.5                       | 20 Extreme solved |
| Master  | `master`  | 14×14 | 16 → 12                                   | 1.8 → 4.0                       | 20 Expert solved  |

Global generator constants: `MIN_PATH_LENGTH = 3` (a length-2 path means adjacent endpoints, which is trivial), `MAX_PATH_LENGTH = floor(0.5 × size²)`, `PAIR_TOLERANCE = 1`, `MAX_ATTEMPTS_PER_RELAX = 400`, `STOP_PROBABILITY = 0.12`, `WARNSDORFF_PROBABILITY = 0.6`. "Bends" of a path = number of direction changes along it.

**Generator outline** (pseudocode; the implementation lives in `src/generator/generate.ts`):

```
generate(tier, levelIndex):
  rng   = mulberry32(seed(tier.id, levelIndex))
  t     = (levelIndex - 1) / (tier.levelCount - 1)
  targetPairs = round(lerp(tier.pairs.atFirst, tier.pairs.atLast, t))
  minBends    = lerp(tier.minAvgBends.atFirst, tier.minAvgBends.atLast, t)

  for relax in [0, 1, 2]:                       # relax constraints only if needed
    tolerance  = PAIR_TOLERANCE + relax
    bendsFloor = minBends * [1, 0.5, 0][relax]
    repeat MAX_ATTEMPTS_PER_RELAX times:
      paths = fillWithRandomWalks(rng, tier.size)
      paths = mergeShortPaths(paths)            # returns null on failure
      if paths == null: continue
      if any(len(p) > MAX_PATH_LENGTH for p in paths): continue
      if abs(len(paths) - targetPairs) > tolerance: continue
      if avgBends(paths) < bendsFloor: continue
      return buildLevel(tier, levelIndex, paths, rng)
  throw GeneratorError   # must be unreachable; a test generates all 600 levels

fillWithRandomWalks(rng, size):
  grid = all empty; paths = []
  while grid has empty cells:
    head = uniformly random empty cell
    path = [head]; mark head
    loop:
      cands = empty orthogonal neighbours of head
      if cands is empty: break
      if len(path) >= MIN_PATH_LENGTH and rng() < STOP_PROBABILITY: break
      if rng() < WARNSDORFF_PROBABILITY:
        next = candidate with the fewest empty neighbours (ties by rng)   # avoids dead pockets
      else:
        next = uniformly random candidate
      push next; mark; head = next
    paths.push(path)
  return paths

mergeShortPaths(paths):
  while exists S in paths with len(S) < MIN_PATH_LENGTH:
    find Q ≠ S such that an end cell of Q is orthogonally adjacent to an end cell of S
    if none: return null
    replace S and Q by their concatenation (reversing either as needed so the adjacent ends meet)
  return paths

buildLevel(tier, levelIndex, paths, rng):
  shuffle(paths, rng)                           # colour assignment is random
  for each path i: if rng() < 0.5 reverse it   # which end is "a" is random
  pairs    = paths.map((p, i) => { color: i, a: p[0], b: p[last] })
  solution = paths
  return { id: `${tier.id}-${pad3(levelIndex)}`, tier: tier.id, index: levelIndex,
           size: tier.size, pairs, solution, seed, generatorVersion: GENERATOR_VERSION }
```

Design note: the Warnsdorff bias (prefer the neighbour with the fewest exits) is what keeps random walks from stranding single cells, which is the main failure mode of naive fill generators. If a tier's acceptance rate is poor (measured by the test in 13), tune `STOP_PROBABILITY` and `WARNSDORFF_PROBABILITY` per tier before changing the algorithm.

### 7.2 Data format

```ts
// src/engine/types.ts
export type Cell = readonly [row: number, col: number];
export type TierId =
  'easy' | 'normal' | 'hard' | 'extreme' | 'expert' | 'master';

export interface LevelPair {
  color: number;
  a: Cell;
  b: Cell;
}

export interface Level {
  id: string; // "hard-042"
  tier: TierId;
  index: number; // 1-based, 1..100
  size: number; // 5 | 6 | 8 | 10 | 12 | 14
  pairs: LevelPair[]; // length K, color === array index
  solution: Cell[][]; // solution[c] is the full path for color c, endpoints included
  seed: number; // uint32
  generatorVersion: number;
}

// src/generator/difficulty.ts
export interface TierConfig {
  id: TierId;
  name: string; // display name
  size: number;
  levelCount: number; // 100
  pairs: { atFirst: number; atLast: number };
  minAvgBends: { atFirst: number; atLast: number };
  unlock: { tier: TierId; solved: number } | null;
}
export const TIERS: readonly TierConfig[] = [/* table in 7.1 */];
```

Example level (Easy, hand-checked, shown for shape only — real levels come from the generator):

```json
{
  "id": "easy-001",
  "tier": "easy",
  "index": 1,
  "size": 5,
  "pairs": [
    { "color": 0, "a": [0, 0], "b": [0, 4] },
    { "color": 1, "a": [1, 0], "b": [1, 3] },
    { "color": 2, "a": [2, 0], "b": [1, 4] },
    { "color": 3, "a": [3, 0], "b": [3, 4] },
    { "color": 4, "a": [4, 0], "b": [4, 4] }
  ],
  "solution": [
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4]
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3]
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [1, 4]
    ],
    [
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4]
    ],
    [
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4]
    ]
  ],
  "seed": 0,
  "generatorVersion": 1
}
```

(This mirrors the Numpuz Easy level 1 in the reference screenshot, which has exactly this layout.)

### 7.3 Initial content

6 tiers × 100 levels = 600 levels, all available at first launch (subject to tier unlock). Ordered by `index` within a tier; difficulty ramps with `t` as defined in 7.1.

## 8. Input & controls

| Input                                | Action                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Touch / mouse / pen: press on a cell | `begin(cell)`                                                                                                                                 |
| Drag                                 | `extend(cell)` for each new cell under the pointer (cell resolved from pointer position with a dead zone of 0 — the full cell area is active) |
| Release / cancel                     | `end()`                                                                                                                                       |
| Keyboard: arrow keys                 | Move a visible cursor cell (wraps at edges: no; clamps)                                                                                       |
| Enter / Space                        | If no stroke active: `begin(cursor)`. If active: `end()`.                                                                                     |
| Arrow keys while stroke active       | Move cursor **and** `extend(cursor)`                                                                                                          |
| Escape                               | If stroke active: `end()`. Else toggle Paused.                                                                                                |
| U or Ctrl/Cmd+Z                      | `undo()`                                                                                                                                      |
| R                                    | `restart()` (with confirm if any path exists)                                                                                                 |
| H                                    | `hint()`                                                                                                                                      |
| Tab / Shift+Tab                      | Standard focus traversal through toolbar and dialogs                                                                                          |

Pointer events use the Pointer Events API with `touch-action: none` on the canvas. Keyboard cursor is only rendered after the first keyboard interaction (avoids clutter for touch users). All buttons have ≥ 44×44 px hit areas and `aria-label`s. The board canvas has `role="application"` and an `aria-label` describing the level; the HUD counters are `aria-live="polite"`.

## 9. UI / UX

Visual language: white page, near-black text, one serif headline face, one sans UI face, hairline rules, black pill buttons, generous whitespace. No gradients, no drop shadows, no illustration. Dark mode inverts the neutrals.

### Screen inventory

**Home**

- Header: `APP_NAME` in the serif face (32 px), small tagline "Connect the dots. Fill the board." below.
- Vertical list of six tier rows. Each row: tier name (sans, 18 px, medium), board size ("8×8", secondary text), progress "23/100" right-aligned, a 2 px progress bar underneath spanning the row. Locked rows are at 40% opacity with a lock glyph and one line: "Solve 20 Hard levels to unlock" (from config, never hard-coded).
- Footer row: "How to play" and a gear icon (Settings), both text buttons.

**LevelSelect(tier)**

- Header: back chevron, "Hard · 8×8" centred, "23/100" right.
- Grid of 100 square tiles, 5 columns, scrollable. Tile states:
  - unsolved: light-gray fill, dark number;
  - solved: black fill, white number;
  - solved with hint: white fill, 1.5 px black border, black number, small dot in the corner;
  - suggested next (first unsolved): unsolved style with a 2 px accent ring.
- Tapping a tile opens Playing.

**Playing**

- Top bar: back chevron (left), "Hard · Level 42" (centre, sans 16 px), pause icon (right).
- Board: centred canvas. `cellPx = floor(min(viewportWidth − 32, viewportHeight − 220) / size)`, clamped to `[20, 72]`. The board is never scrollable; it always fits.
- Stats row directly under the board, secondary text 14 px, three items separated by "·": `Lines 3/8 · Filled 62% · 1:24`.
- Toolbar under the stats: three icon+label buttons — Undo, Hint, Restart. Disabled state at 35% opacity (Undo when stack empty; all three during an active stroke).

**Paused** (modal over Playing; board hidden)

- "Paused" (serif 28 px), elapsed time, buttons: Resume (primary pill), Restart, Level list, Settings, How to play.

**Won** (modal card over the solved board, which stays visible behind at 100% opacity)

- Heading: "Solved" (serif 28 px). If Perfect: "Perfect" replaces it, with a one-line explanation below ("No hints, every line drawn once").
- Rows: "Time 1:24", "Best 1:02" (or "New best" badge when improved), "Hint used" if applicable.
- Buttons: Next level (primary pill, full width), Replay, Level list (text buttons).

**Settings** (modal, from Home or Paused)

- Theme: System / Light / Dark (segmented control)
- Sound: on/off
- Haptics: on/off (hidden if `navigator.vibrate` is unavailable)
- Colour-blind labels: on/off
- Reduced motion: System / On / Off
- Reset progress (destructive text button → ConfirmReset modal)
- Version string and `GENERATOR_VERSION` in small secondary text at the bottom.

**HowToPlay** (modal)

- Three short paragraphs with a tiny static illustration drawn by the same board renderer: (1) drag between matching dots, (2) lines can't cross — drawing over a line cuts it, (3) fill every cell to solve.

### HUD elements during play

Lines counter, coverage percentage, timer, undo/hint/restart availability. Nothing else.

### Feedback

| Event                           | Visual                                                                                  | Sound (synth)                                  | Haptic                  |
| ------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| Stroke begins on endpoint       | Endpoint scales to 1.15× for 120 ms                                                     | none                                           | none                    |
| Cell appended                   | Path segment grows with 60 ms ease-out; cell tint fades in                              | none                                           | none                    |
| Path completed                  | Both endpoints pulse once (1.0→1.2→1.0, 200 ms)                                         | two-note rising blip (C5→E5, 80 ms each, sine) | `vibrate(10)`           |
| Path cut by another colour      | Removed segment fades out over 120 ms                                                   | soft low tick (120 Hz, 40 ms, triangle)        | none                    |
| Blocked move (foreign endpoint) | Nothing (silent rejection)                                                              | none                                           | none                    |
| Win                             | Paths brighten to 100% alpha in colour order, 40 ms stagger; then card slides up 200 ms | 4-note arpeggio (C5 E5 G5 C6, 90 ms each)      | `vibrate([10, 40, 20])` |
| Undo / restart                  | Paths removed instantly (no animation)                                                  | UI tick (1 kHz, 20 ms)                         | none                    |
| Hint                            | Solution path draws in cell by cell, 30 ms per cell                                     | same as path completed                         | same                    |

With reduced motion on: all durations become 0 and the win stagger is removed; the card appears instantly.

### Undo / hint / restart / pause behaviour

As defined in 5.2 and 6. Restart shows a confirm only if at least one path cell exists beyond endpoints. Pause hides the board.

### Settings

Listed above; persisted immediately on change (11.2).

## 10. Art & audio direction

**Neutrals (light)**: background `#FFFFFF`, text `#121212`, secondary text `#6E6E6E`, hairline `#DCDCDC`, grid line `#E8E8E8`, cell background `#F7F7F7`, disabled `#B8B8B8`, accent (ring/focus) `#121212`.
**Neutrals (dark)**: background `#121212`, text `#F5F5F5`, secondary `#A0A0A0`, hairline `#2E2E2E`, grid line `#262626`, cell background `#1A1A1A`, disabled `#555555`, accent `#F5F5F5`.

**Path palette** (16 colours; index = colour id; ordered so that any prefix is as mutually distinct as possible; identical in light and dark themes):

| #   | Hex              | #   | Hex              | #   | Hex              | #   | Hex              |
| --- | ---------------- | --- | ---------------- | --- | ---------------- | --- | ---------------- |
| 0   | `#D62828` red    | 4   | `#8338EC` purple | 8   | `#2A9D8F` teal   | 12  | `#A0522D` sienna |
| 1   | `#118AB2` blue   | 5   | `#FF7A00` orange | 9   | `#FF3D8A` pink   | 13  | `#48CAE4` sky    |
| 2   | `#F2B705` yellow | 6   | `#06D6A0` mint   | 10  | `#6A4C93` violet | 14  | `#8C8C8C` gray   |
| 3   | `#3FA34D` green  | 7   | `#073B4C` navy   | 11  | `#B5E048` lime   | 15  | `#F4A3B5` blush  |

Colour-blind labels mode: each endpoint shows its colour index + 1 as a numeral (white or black, whichever has ≥ 4.5:1 contrast against the colour) in a 12 px bold sans; the numeral is drawn only on endpoints, not along paths. Palette is limited to 16 because Master's maximum pair count is 16.

**Board rendering** (Canvas, devicePixelRatio-aware):

- Cell: filled with cell background, 1 px grid line between cells, board has a 2 px outer border in hairline colour and 8 px corner radius.
- Endpoint: filled circle, diameter `0.62 × cellPx`, centred.
- Path: polyline through cell centres, stroke width `0.36 × cellPx`, round caps and joins, alpha 0.92 (1.0 for the active stroke).
- Occupied cell tint: the path colour at 14% alpha filling the cell (this is the coverage cue).
- Keyboard cursor: 2 px accent-colour inset rectangle.

**Typography**: headings `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`; UI `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. No web fonts in MVP (zero network dependency, instant load). Minimum body size 14 px; tier names 18 px; HUD 14 px.

**Placeholder strategy**: there are no external assets. Icons (back chevron, pause, undo, hint bulb, restart, gear, lock) are inline SVG paths defined in `src/app/icons.ts` — 24×24, 1.75 px stroke, `currentColor`. If time is short, use the Unicode glyphs `‹ ⏸ ↶ 💡 ↻ ⚙ 🔒` as placeholders and note it in the phase report. Favicon: a generated 64×64 SVG of two dots joined by a rounded line.

**Sound list** (all synthesised in `src/audio/sfx.ts` with Web Audio, master gain 0.25, AudioContext created lazily on first user gesture):
`sfx.connect`, `sfx.cut`, `sfx.win`, `sfx.tick`. Parameters as in the 9 feedback table.

## 11. Technical design

### 11.1 Architecture

| Module           | Responsibility                                                                                                                                                                                                                                                                                                    | Dependencies            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `src/engine/`    | Pure game rules: types, `Engine` state and operations (5.2), win/coverage queries, undo stack. Zero DOM, zero randomness, fully unit-tested.                                                                                                                                                                      | none                    |
| `src/generator/` | `prng.ts` (fnv1a32, mulberry32), `difficulty.ts` (TIERS), `generate.ts` (7.1), `validate.ts` (asserts a level's solution replays to Won through the engine). Pure.                                                                                                                                                | engine (validate only)  |
| `src/render/`    | `BoardRenderer` (Canvas draw of a read-only engine state + animation state), `layout.ts` (cell size, pixel↔cell mapping), `theme.ts` (palette, CSS variable sync).                                                                                                                                                | engine (types only)     |
| `src/input/`     | `pointer.ts` maps Pointer Events on the canvas to `begin/extend/end`; `keyboard.ts` maps keys to engine ops and the cursor.                                                                                                                                                                                       | engine, render (layout) |
| `src/app/`       | `state.ts` (screen + modal state machine of section 6), `App.ts` (bootstrap, routing, wiring), `screens/` (Home, LevelSelect, Play), `modals/` (Paused, Won, Settings, HowToPlay, ConfirmReset), `progress.ts` (unlock rules, best times), `strings.ts`, `config.ts` (`APP_NAME`, version), `icons.ts`. DOM only. | all of the above        |
| `src/storage/`   | `persistence.ts`: typed load/save for the three keys, schema version, safe parsing with fallback to defaults.                                                                                                                                                                                                     | none                    |
| `src/audio/`     | `sfx.ts`, `haptics.ts`.                                                                                                                                                                                                                                                                                           | none                    |
| `src/styles/`    | `base.css` (reset, tokens as CSS variables, light/dark), `screens.css`.                                                                                                                                                                                                                                           | —                       |

Rules: `engine` and `generator` must have no imports from `render`, `input`, `app`, or the DOM. The renderer is stateless with respect to game rules — it reads the engine state each frame. Rendering is on demand (redraw on state change) plus a `requestAnimationFrame` loop that runs only while an animation is active.

### 11.2 Data & persistence

localStorage, JSON, all under the `colorlink:v1:` prefix. `v1` is the schema version; a mismatch on load resets that key to defaults (never crashes).

| Key                       | Shape                                                                                                                               | Written when                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `colorlink:v1:progress`   | `{ tiers: Record<TierId, { solved: Record<number, { bestMs: number; hint: boolean; perfect: boolean; at: string }> }> }`            | on every level completion                                                                             |
| `colorlink:v1:settings`   | `{ theme: 'system'\|'light'\|'dark'; sound: boolean; haptics: boolean; colorBlind: boolean; reducedMotion: 'system'\|'on'\|'off' }` | on every settings change                                                                              |
| `colorlink:v1:inProgress` | `{ levelId: string; paths: Cell[][]; elapsedMs: number; moves: number; hintUsed: boolean } \| null`                                 | on every `end()`, `undo`, `restart`, `hint`, pause; cleared on win or when leaving the level via back |

Unlock rule (`progress.ts`): `isUnlocked(tier) = tier.unlock == null || count(solved in tier.unlock.tier) ≥ tier.unlock.solved`.

### 11.3 Performance constraints

- Level generation: ≤ 150 ms for Master on a mid-range phone; test asserts all 600 levels generate in < 20 s total on the CI/desktop Node runtime.
- Rendering: 60 fps during drag on a 14×14 board on a mid-range phone. Full-board redraw ≤ 4 ms at DPR 3. Only redraw on state change or during animation.
- Initial load: no network after the HTML/JS/CSS; total JS bundle < 80 kB gzipped.
- Memory: undo snapshots are `paths` arrays only (≤ 200 cells × 16 colours); no images.

### 11.4 Dependencies

| Package          | Version       | Purpose                  | Justification                         |
| ---------------- | ------------- | ------------------------ | ------------------------------------- |
| `vite`           | latest stable | dev server, bundler      | default stack                         |
| `typescript`     | ^5            | language, `strict: true` | default stack                         |
| `vitest`         | latest stable | unit tests               | default test runner for Vite projects |
| `prettier` (dev) | latest stable | formatting               | zero-config; one `.prettierrc`        |

Nothing else. No UI framework, no state library, no canvas library, no audio library, no icon package. `vite-plugin-pwa` is listed under 14.2 and must not be added without asking.

## 12. Acceptance criteria

Each item is verified either by `npm test` (T) or by running the app (R).

1. (T) `npm run build` completes with zero TypeScript errors under `strict: true`; `npm test` passes with zero skipped tests.
2. (T) `generate(tier, i)` called twice with the same inputs returns deep-equal levels; called with different `i` returns different levels.
3. (T) For every one of the 600 levels: the solution covers exactly `size²` cells with no duplicates; every path has length ≥ 3 and ≤ `MAX_PATH_LENGTH`; pair count is within `PAIR_TOLERANCE + 2` of the level's target; `K ≤ 16`.
4. (T) For every one of the 600 levels, replaying `solution` through the engine (`begin(a)`, `extend` each cell) results in `won == true`.
5. (T) All 600 levels generate in under 20 s total; no level reaches `relax = 2` more than 5% of the time per tier (logged, not failing, in MVP).
6. (T) Engine invariants (5.2) hold after a randomised sequence of 10,000 operations on each board size (property test with a seeded PRNG).
7. (T) Cut, backtrack, blocked-endpoint, straight-line interpolation, and completion rules each have a dedicated unit test that matches the tables in 5.2.
8. (R) Home lists six tiers in ladder order with correct board sizes; Extreme, Expert and Master show the lock and the exact unlock sentence; solving 20 Hard levels unlocks Extreme without a reload.
9. (R) Every tier's level grid shows 100 tiles; tile states (unsolved / solved / solved-with-hint / suggested next) render as in section 9.
10. (R) On a 360×640 viewport, every board size including 14×14 fits without scrolling and all toolbar buttons remain reachable.
11. (R) Win triggers only when all pairs are connected **and** coverage is 100%; connecting all pairs with an empty cell remaining does not trigger it.
12. (R) Undo reverts exactly one stroke; Restart clears the board; Hint draws one correct path and marks the result as hint-used on the Won card and level tile.
13. (R) Timer starts on first pointer-down, stops on win, pauses in Paused and when the tab is hidden, and resumes correctly.
14. (R) Closing the tab mid-level and reopening the app restores the same level, paths, and elapsed time.
15. (R) A level can be selected, played and solved using the keyboard only.
16. (R) Colour-blind labels, dark theme, and reduced motion each take effect immediately when toggled and persist across reloads.
17. (R) The DevTools Network panel shows zero requests after initial load during a full level.
18. (R) No console errors or warnings during the manual test script in section 13.
19. (R) Lighthouse (mobile) accessibility score ≥ 90.

## 13. Test plan

### Unit tests (Vitest)

`tests/engine/`

- `begin.test.ts`: begin on endpoint clears existing path; begin on mid-path truncates; begin on empty is a no-op.
- `extend.test.ts`: append empty; backtrack to earlier cell truncates; blocked by foreign endpoint; completes on twin endpoint and refuses further extension; cut removes tail of other colour and appends; non-adjacent same-row/column interpolates and stops at first rejection; non-adjacent diagonal is a no-op.
- `win.test.ts`: all connected + full → won; all connected + one empty → not won; coverage counts endpoints.
- `undo.test.ts`: end() with no change pushes nothing; undo restores; stack cleared on restart.
- `hint.test.ts`: chooses lowest differing colour; cuts conflicting paths; no-op when won.
- `invariants.test.ts`: property test — 10,000 seeded random ops per board size, invariants asserted after each.

`tests/generator/`

- `prng.test.ts`: mulberry32 known-answer vector (first 5 outputs for seed 1); fnv1a32 known-answer for `"v1|easy|1"`.
- `determinism.test.ts`: same inputs → deep-equal; `GENERATOR_VERSION` change → different level.
- `all-levels.test.ts`: generates all 600; asserts criteria 3, 4, 5; records per-tier relax-level histogram to console.
- `no-math-random.test.ts`: reads `src/generator/**/*.ts` and fails if `Math.random` appears.
- `difficulty.test.ts`: TIERS is in ladder order, sizes strictly increasing, pairs ≤ 16, unlock references point to the previous tier only.

`tests/storage/`

- `persistence.test.ts`: round-trip each key; corrupt JSON → defaults; wrong schema version → defaults.

`tests/app/`

- `progress.test.ts`: unlock logic; best-time only updates when lower; perfect flag requires `moves == K && !hintUsed`.

### Manual test script

1. Fresh profile (clear localStorage). Launch. Verify Home: six tiers, three locked with unlock text, 0/100 everywhere.
2. Open Easy. Verify 100 tiles, tile 1 has the suggested-next ring.
3. Open level 1. Timer shows 0:00 and does not run. Press on a red endpoint: timer starts. Drag to the twin: endpoints pulse, sound plays, Lines shows 1/K.
4. Draw a second colour across the first: verify the first is cut back and Lines decrements.
5. Drag a colour into a foreign endpoint: verify nothing happens.
6. Backtrack along the active path: verify it shortens.
7. Connect all pairs leaving one cell empty: verify not won and coverage < 100%. Fill it: verify Won card with time.
8. Tap Next level. Solve level 2 using Hint once; verify "Hint used" on the card and the hollow tile in the grid.
9. Start level 3, draw two paths, press back. Reopen the app: verify it resumes level 3 with both paths and the timer.
10. Press pause; verify the board is hidden and the timer stops. Switch tabs and return; verify it is paused.
11. Settings: toggle dark, colour-blind labels, reduced motion, sound off. Reload; verify all persisted.
12. Keyboard only: navigate to Normal level 1 with Tab/Enter; solve it with arrows/Enter; undo with U; restart with R.
13. Temporarily set Hard's unlock threshold to 1 via the config (or solve 20 Hard levels); verify Extreme unlocks on returning Home. Restore the config.
14. Open Master level 100 on a 360 px-wide viewport (DevTools device mode). Verify the board fits and cells are ≥ 20 px.
15. Reset progress; verify Home is back to fresh state.

### Known tricky scenarios to verify

- Fast diagonal flick across the board (no cells should be skipped illegally; diagonal moves are ignored, straight ones interpolate).
- Winning mid-drag: the last cell filled while the pointer is still down must trigger Won and ignore further movement.
- Cutting a path at its first cell after the endpoint (the endpoint stays, the path becomes length 1).
- Undo immediately after a hint.
- Rotating the device mid-stroke.
- DPR 3 rendering: no blurry lines, no half-pixel grid seams.

## 14. Scope

### 14.1 MVP (this build)

Everything in sections 5–13 and phases 0–5 of section 17: six tiers, 600 generated levels, full drag/keyboard input, undo/hint/restart/pause, Home/LevelSelect/Play/Won/Paused/Settings/HowToPlay, persistence and resume, dark mode, colour-blind labels, reduced motion, synthesised sound and haptics, full test suite.

### 14.2 Later / stretch

- Installable PWA with offline caching (`vite-plugin-pwa`, manifest, icons) — phase 6.
- Solution-uniqueness filter in the generator for Easy–Hard (solver is cheap at ≤ 8×8), with `GENERATOR_VERSION` bump.
- Build-time level pre-baking script (`scripts/bake-levels.ts`) producing `public/levels.json` as a fallback for low-end devices.
- Share card (emoji grid of the solution, NYT-style) and per-tier stats screen (average time, perfect count).
- Daily puzzle (seed from date) on the Home screen.
- French localisation via `strings.ts`.
- Optional "Hell" tier (16×16) if Tob wants it.

### 14.3 Explicitly out of scope

Accounts, cloud sync, leaderboards, ads, in-app purchases, coins, timers as a fail condition, sequential level locks within a tier, native app wrappers, hexagonal or non-square boards, bridges/walls/special cells.

## 15. Open questions

1. Confirm the ladder in assumption 1 (drop "Hell"; Extreme 10×10, Expert 12×12, Master 14×14).
2. Confirm full-coverage win rule (assumption 4) versus "all pairs connected" only.
3. Working title "Color Link" — keep, or rename before build? (One constant either way.)

## 16. Hand-off to Claude Code

### 16.1 Repository layout

```
color-link/
├── CLAUDE.md
├── docs/
│   └── pOZle_color-link_spec_v1.0.md      # this file — the source of truth
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts                          # includes the vitest `test` block
├── .prettierrc
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts
│   ├── app/
│   │   ├── App.ts
│   │   ├── state.ts
│   │   ├── config.ts
│   │   ├── strings.ts
│   │   ├── icons.ts
│   │   ├── progress.ts
│   │   ├── screens/  Home.ts  LevelSelect.ts  Play.ts
│   │   └── modals/   Paused.ts  Won.ts  Settings.ts  HowToPlay.ts  ConfirmReset.ts
│   ├── engine/
│   │   ├── types.ts
│   │   ├── engine.ts                       # Engine class: begin/extend/end/undo/restart/hint
│   │   └── queries.ts                      # isWon, coverage, completedCount
│   ├── generator/
│   │   ├── prng.ts
│   │   ├── difficulty.ts
│   │   ├── generate.ts
│   │   └── validate.ts
│   ├── render/
│   │   ├── BoardRenderer.ts
│   │   ├── layout.ts
│   │   └── theme.ts
│   ├── input/
│   │   ├── pointer.ts
│   │   └── keyboard.ts
│   ├── storage/
│   │   └── persistence.ts
│   ├── audio/
│   │   ├── sfx.ts
│   │   └── haptics.ts
│   └── styles/
│       ├── base.css
│       └── screens.css
└── tests/
    ├── engine/
    ├── generator/
    ├── storage/
    └── app/
```

### 16.2 Setup & run commands

```bash
# scaffold
npm create vite@latest color-link -- --template vanilla-ts
cd color-link
npm install
npm install -D vitest prettier

# add scripts to package.json:
#   "dev": "vite", "build": "tsc --noEmit && vite build", "preview": "vite preview",
#   "test": "vitest run", "test:watch": "vitest", "format": "prettier --write ."

npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # type-check + production bundle in dist/
npm run preview    # serve dist/ locally
```

`tsconfig.json` must set `"strict": true`, `"noUncheckedIndexedAccess": true`, `"target": "ES2020"`, `"lib": ["ES2020", "DOM"]`. `vite.config.ts` includes `test: { environment: 'node', include: ['tests/**/*.test.ts'] }` (the engine and generator tests need no DOM; screen tests, if any, may opt into `jsdom` per file).

### 16.3 CLAUDE.md snippet

```markdown
# Color Link — conventions for Claude Code

- The spec is `docs/pOZle_color-link_spec_v1.0.md`. It is the source of truth. If code and spec disagree, the spec wins; if the spec is ambiguous or wrong, stop and ask rather than guess.
- Build in the phase order of spec section 17. Do not start a phase until the previous phase's definition of done is met. Report at each milestone.
- `src/engine/**` and `src/generator/**` are pure TypeScript: no DOM, no `window`, no `Math.random`, no imports from `app/`, `render/`, `input/`.
- TypeScript strict mode; no `any`; no `// @ts-ignore`.
- Tests live in `tests/` mirroring `src/`. Every rule in spec 5.2 has a named test. Run `npm test` before every commit; never commit red.
- Formatting: Prettier defaults (`.prettierrc`: `{ "singleQuote": true, "semi": true }`). Run `npm run format` before committing.
- Dependencies: only those in spec 11.4. Ask before adding anything.
- All user-facing text goes through `src/app/strings.ts`. All tunables go in `src/app/config.ts` or `src/generator/difficulty.ts`.
- Commit at the end of every phase with a message `phase N: <milestone name>`; smaller commits within a phase are welcome.
- Never bump `GENERATOR_VERSION` without adding a changelog line to the spec and telling Tob.
```

### 16.4 Kickoff prompt

Paste this into Claude Code in the empty `color-link/` folder (after copying the spec into `docs/`):

> Read `docs/pOZle_color-link_spec_v1.0.md` in full before doing anything else. Then create `CLAUDE.md` from section 16.3. Build the MVP defined in section 14.1 by executing the phases in section 17 strictly in order: complete phase 0 (scaffold, 16.1–16.2), then phase 1 (pure rules engine with the tests named in 13), then phase 2 (deterministic generator, difficulty config, all-levels test), then phase 3 (canvas renderer and pointer/keyboard input), then phase 4 (screens, state machine, persistence), then phase 5 (polish, accessibility, audio). At the end of each phase, run `npm test` and `npm run build`, confirm that phase's definition of done, commit, and post a short report listing what was built, any deviation from the spec, and anything you need from me — then continue to the next phase without waiting unless you have a blocking question. Before reporting the build done, walk through every item in section 12 and state pass/fail for each. Do not add any dependency not listed in 11.4 without asking. Do not implement anything from 14.2 or 14.3.

## 17. Build plan: phases & milestones

Each phase has a scope, a definition of done (DoD), and a milestone name for the commit and the report. Estimated effort is for a single Claude Code session; phases 0–5 are MVP.

### Phase 0 — Scaffold

**Scope**: run the commands in 16.2; create the folder tree in 16.1 with empty modules; `index.html` with `<div id="app">` and a `<canvas>` placeholder; `base.css` with the neutral tokens from section 10 as CSS variables for light and dark (`prefers-color-scheme` plus a `data-theme` attribute override); `strings.ts` and `config.ts` with `APP_NAME` and `APP_VERSION`; a trivial passing test; `CLAUDE.md`.
**DoD**: `npm run dev` shows the app name on a white page; `npm test` passes; `npm run build` succeeds.
**Milestone M0**: "scaffold".

### Phase 1 — Rules engine (pure)

**Scope**: `engine/types.ts`, `engine/engine.ts` implementing every row of the 5.2 table, `engine/queries.ts` (won, coverage, completed count), undo stack, hint. Write the tests in 13 `tests/engine/` first or alongside; include the invariant property test.
**DoD**: all `tests/engine/*` pass; engine has no DOM imports; a hand-written 5×5 level (the example in 7.2) replays to `won == true`.
**Milestone M1**: "rules engine green".

### Phase 2 — Generator

**Scope**: `prng.ts` with known-answer tests, `difficulty.ts` with the TIERS table, `generate.ts` per 7.1, `validate.ts` (replay through engine). Add `tests/generator/*` including the all-600-levels test with timing and the relax-level histogram.
**DoD**: all 600 levels generate, validate, and meet acceptance criteria 2–5. If any tier's relax-2 rate exceeds 5%, tune `STOP_PROBABILITY` / `WARNSDORFF_PROBABILITY` (per tier if needed) and report the final numbers.
**Milestone M2**: "600 levels validated".

### Phase 3 — Board renderer & input

**Scope**: `render/layout.ts` (cell size formula from section 9, pixel↔cell mapping, DPR handling), `render/BoardRenderer.ts` (grid, endpoints, paths, tints, cursor, animation state hooks), `input/pointer.ts`, `input/keyboard.ts`. A temporary dev harness in `main.ts` that loads `generate(TIERS[2], 1)` and renders it.
**DoD**: a Hard level is fully playable in the browser with mouse, touch (DevTools device mode), and keyboard; cut/backtrack/complete behave per 5.2; console logs `WON` when solved; the board fits on 360×640 for size 14.
**Milestone M3**: "playable level".

### Phase 4 — Screens, state machine, persistence

**Scope**: `app/state.ts` (section 6), `app/App.ts`, Home, LevelSelect, Play (top bar, stats row, toolbar, timer), Paused, Won, Settings, HowToPlay, ConfirmReset; `app/progress.ts` (unlocks, best times, perfect); `storage/persistence.ts` with the three keys and schema guards; in-progress resume on boot; `visibilitychange` auto-pause. Remove the phase-3 dev harness.
**DoD**: the full core loop of section 4 works end to end; progress and in-progress board survive a reload; tier unlock works; `tests/storage/*` and `tests/app/*` pass; acceptance criteria 8–14 pass.
**Milestone M4**: "full loop + persistence".

### Phase 5 — Polish, accessibility, audio

**Scope**: animations from the section 9 feedback table with reduced-motion switch; `audio/sfx.ts` and `audio/haptics.ts`; colour-blind labels; dark theme QA; inline SVG icons; focus styles and `aria` attributes; keyboard-only pass; favicon; Lighthouse run.
**DoD**: acceptance criteria 15–19 pass; the manual test script in 13 runs clean; a final report lists every item of section 12 with pass/fail.
**Milestone M5**: "MVP complete".

### Phase 6 — PWA & release _(stretch, only if Tob asks)_

**Scope**: `vite-plugin-pwa` (ask first), manifest, 192/512 icons, offline caching of the app shell, `README.md` with deploy instructions for a static host (GitHub Pages or Netlify).
**DoD**: installable on Android Chrome and iOS Safari; works offline after first load; Lighthouse PWA checks pass.
**Milestone M6**: "installable".

### Reporting format at each milestone

```
## Phase N — <milestone>
Built: <3–6 bullets>
Tests: <count> passing, <count> skipped
Deviations from spec: <none | list with reason>
Needs Tob: <none | questions>
Next: Phase N+1
```

## Changelog

- v1.0 — initial spec
- v1.0-as-built — MVP delivered (phases 0–5). `GENERATOR_VERSION` is unchanged at 1, so every level is exactly as this spec defines. The notes below record where the build diverged from the letter of the spec, so later work does not "fix" them back.

### As-built notes

**Generator stop probability is per level, not the flat 0.12 (section 7.1).** With `STOP_PROBABILITY = 0.12` the generator could not produce Master levels at all (1200 attempts, no candidate) and missed the pair target badly at both ends of the ladder: one probability cannot serve a 5×5 board wanting 4-cell paths and a 14×14 board wanting 16-cell ones. Section 7.1 sanctions tuning this constant when acceptance is poor, so it is now derived from the average path length each level needs, with a board-size correction for walks that stop early because they run out of neighbours. `WARNSDORFF_PROBABILITY` went 0.6 → 0.95 by measurement. Result: all 600 levels are accepted at `relax = 0`, in 225 ms total.

**A path holding only its own start endpoint is stored as no path.** Otherwise pressing an endpoint and releasing without dragging counted as a move, consumed an undo slot, and cost the player the "Perfect" badge, even though the board looked untouched. Only an in-flight stroke sits at length 1.

**`hint()` starts the timer.** Section 6 starts it on the first `begin`, which would record 0:00 for a level solved entirely with hints.

**`pathCut` events carry the removed cells,** so the renderer can fade exactly the segment that was cut (section 9 feedback table).

**Dependencies (section 11.4): `jsdom` added, dev-only.** Section 16.2 already anticipates it ("screen tests, if any, may opt into `jsdom` per file"). It earns its place: the one bug that escaped the unit suite was a DOM-attribute bug — the element builder wrote `aria-checked` as an empty string for `true` and dropped it entirely for `false`, so the Settings switches silently never toggled. No effect on the shipped bundle.

**Repository layout (section 16.1): `scripts/verify/` added.** `npm run verify` starts a dev server, drives a headless Chromium-based browser through the app, and checks the acceptance criteria in section 12 that can only be judged by running it. 89 checks in about 55 s, with no npm dependency beyond Node's built-in `fetch` and `WebSocket`.

**`index.html` drops `maximum-scale=1.0, user-scalable=no`.** Blocking zoom fails an accessibility audit, and `touch-action: none` on the canvas already stops the board being panned or double-tap-zoomed during a drag.

**Home tier rows carry no `aria-label`.** A label that does not contain the row's own visible text breaks voice control and fails the axe `label-content-name-mismatch` rule. The row's content already reads "Easy 5×5 0/100".

**Verified at delivery:** 175 unit tests, 89 browser checks, all 600 levels generated and replayed, and Lighthouse (mobile) on the production build at 100 accessibility, 100 performance, 100 best practices.
