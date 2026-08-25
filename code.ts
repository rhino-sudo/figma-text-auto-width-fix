// Text Auto Width Fix
//
// Takes the current selection as the root, walks every descendant, and flips
// each TEXT node's own resizing mode from Auto Height ("HEIGHT") to
// Auto Width ("WIDTH_AND_HEIGHT").
//
// This is the TEXT NODE's textAutoResize property, not an Auto Layout frame's
// sizing mode. Nothing else on the node is touched: content, font, size, fills,
// effects and position are all left alone.

const TARGET: 'WIDTH_AND_HEIGHT' = 'WIDTH_AND_HEIGHT';

interface SkippedNode {
  id: string;
  name: string;
  path: string;
  reason: string;
}

interface Report {
  dryRun: boolean;
  rootCount: number;
  totalText: number;
  changed: number;
  alreadyAutoWidth: number;
  skipped: SkippedNode[];
}

/** Depth-first walk of the selection; returns every TEXT node found. */
function collectTextNodes(roots: readonly SceneNode[]): TextNode[] {
  const found: TextNode[] = [];
  const seen = new Set<string>();
  const stack: SceneNode[] = roots.slice();

  while (stack.length > 0) {
    const node = stack.pop() as SceneNode;
    if (seen.has(node.id)) continue;
    seen.add(node.id);

    if (node.type === 'TEXT') {
      found.push(node);
    }

    // Covers frames, groups, sections, components, component sets and
    // instances: anything that can hold children.
    if ('children' in node) {
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        stack.push(children[i]);
      }
    }
  }

  return found;
}

/** "Page / Card / Header / Title", so a skipped layer can actually be found. */
function pathOf(node: BaseNode): string {
  const parts: string[] = [];
  let current: BaseNode | null = node;
  while (current && current.type !== 'DOCUMENT') {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(' / ');
}

function isInsideInstance(node: BaseNode): boolean {
  let current: BaseNode | null = node.parent;
  while (current) {
    if (current.type === 'INSTANCE') return true;
    current = current.parent;
  }
  return false;
}

const loadedFonts = new Set<string>();

/**
 * Editing a text node requires its fonts to be loaded first, including every
 * font used by a mixed-style range.
 */
async function loadFontsFor(node: TextNode): Promise<void> {
  let fonts: FontName[];

  if (node.characters.length > 0) {
    fonts = node.getRangeAllFontNames(0, node.characters.length);
  } else if (node.fontName === figma.mixed) {
    fonts = [];
  } else {
    fonts = [node.fontName as FontName];
  }

  for (const font of fonts) {
    const key = font.family + ' ' + font.style;
    if (loadedFonts.has(key)) continue;
    await figma.loadFontAsync(font);
    loadedFonts.add(key);
  }
}

function describeError(node: TextNode, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (node.textTruncate === 'ENDING') {
    return 'Text truncation is enabled. Figma does not allow Auto Width with truncation, so turn truncation off first.';
  }
  if (isInsideInstance(node)) {
    return 'Inside a component instance and this property is locked by the main component. ' + raw;
  }
  if (/font/i.test(raw)) {
    return 'Font could not be loaded (missing font?): ' + raw;
  }
  return raw;
}

async function run(dryRun: boolean): Promise<void> {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.closePlugin('Select one or more frames, groups or components first.');
    return;
  }

  const textNodes = collectTextNodes(selection);
  const report: Report = {
    dryRun: dryRun,
    rootCount: selection.length,
    totalText: textNodes.length,
    changed: 0,
    alreadyAutoWidth: 0,
    skipped: [],
  };
  const skippedNodes: TextNode[] = [];

  for (const node of textNodes) {
    if (node.textAutoResize === TARGET) {
      report.alreadyAutoWidth++;
      continue;
    }

    if (dryRun) {
      report.changed++;
      continue;
    }

    try {
      await loadFontsFor(node);

      // A text node set to "Fill container" inside an Auto Layout parent cannot
      // also be Auto Width, so hug first. Reading layoutSizingHorizontal throws
      // when the parent is not an Auto Layout frame, hence the guard.
      const parent = node.parent;
      if (parent && 'layoutMode' in parent && parent.layoutMode !== 'NONE') {
        if (node.layoutSizingHorizontal === 'FILL') {
          node.layoutSizingHorizontal = 'HUG';
        }
      }

      node.textAutoResize = TARGET;

      // Instance overrides can silently refuse the write.
      if (node.textAutoResize !== TARGET) {
        throw new Error('Figma refused the change and kept the old value.');
      }

      report.changed++;
    } catch (error) {
      skippedNodes.push(node);
      report.skipped.push({
        id: node.id,
        name: node.name,
        path: pathOf(node),
        reason: describeError(node, error),
      });
    }
  }

  const extraRows = Math.min(report.skipped.length, 6);
  figma.showUI(__html__, {
    width: 400,
    height: 230 + extraRows * 52,
    themeColors: true,
  });
  figma.ui.postMessage(report);

  figma.ui.onmessage = (message: { type: string }) => {
    if (message.type === 'select-skipped' && skippedNodes.length > 0) {
      figma.currentPage.selection = skippedNodes;
      figma.viewport.scrollAndZoomIntoView(skippedNodes);
    } else if (message.type === 'close') {
      figma.closePlugin();
    }
  };
}

run(figma.command === 'preview');
