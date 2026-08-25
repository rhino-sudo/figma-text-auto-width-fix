# Text Auto Width Fix

Figma plugin. Select one or more frames / groups / components, run it, and every
`TEXT` node nested anywhere inside them is switched from **Auto Height**
(`textAutoResize = "HEIGHT"`) to **Auto Width** (`textAutoResize = "WIDTH_AND_HEIGHT"`).

This changes the **text layer's** resizing mode, not an Auto Layout frame's sizing mode.

## What it does

- Uses the current selection as the root (a selected text layer works too).
- Walks all descendants depth-first: groups, frames, auto-layout frames, sections,
  components, component sets, instances.
- Sets `textAutoResize = "WIDTH_AND_HEIGHT"` on every text node it finds.
- Leaves content, font, size, fills, effects, constraints and position alone.
- Reports how many layers it converted, how many were already Auto Width, and lists
  anything it could not change (with the reason and the layer path) instead of failing.

Two details worth knowing:

- Fonts are loaded before each edit (`figma.loadFontAsync`), including mixed-style
  ranges, because Figma refuses text edits with unloaded fonts.
- A text layer set to **Fill container** inside an Auto Layout parent cannot also be
  Auto Width, so the plugin flips it to **Hug** horizontally first. That is the one
  extra property it touches, and only when required.

Known cases that get reported rather than forced:

- Text with **truncation** enabled — Figma disallows Auto Width + truncate.
- Text inside an instance whose property the main component locks.
- Missing fonts that cannot be loaded.

## Install (local development plugin)

1. Open the **Figma desktop app** (local plugins do not work in the browser).
2. Menu → **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json` in this folder.

That's it — no `npm install`, no build. `code.js` is plain JavaScript and ships ready to run.

## Run

1. Select the frame (or several frames / components) you want to fix.
2. **Plugins → Development → Text Auto Width Fix → Convert all text to Auto Width**
3. A panel reports the counts. Press **Done** to close.

Use **Preview (count only, no changes)** first if you want to see how many layers
would change without touching the file. Undo (`⌘Z`) reverts the whole run in one step.

## Editing the source

`code.js` is what Figma runs. `code.ts` is the same logic with types, if you prefer
to work in TypeScript:

```bash
npm install && npm run build
```

which compiles `code.ts` over `code.js`. If you edit `code.js` directly, keep `code.ts`
in sync or delete it.
