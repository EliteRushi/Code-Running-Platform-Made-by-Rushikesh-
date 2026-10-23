# Code Playground — Implementation Plan

## Product scope

Build a static, GitHub Pages-compatible browser IDE for HTML, CSS, JavaScript, and Python. The application keeps source files in memory by default, executes web previews in a sandboxed iframe, runs Python through Pyodide in the browser, and offers both same-page preview and a separate `output.html` viewer. No backend, database, account system, server-side execution, or automatic permanent source persistence is used.

## Implementation approach

- Use plain HTML5, CSS3, and modular vanilla JavaScript with no build step.
- Use CodeMirror 6 from public ESM CDNs for a lightweight editor with syntax highlighting, line numbers, bracket matching, autocomplete, search, indentation, and light/dark themes. A textarea fallback remains available if the editor module cannot load.
- Keep the active project in a single in-memory state object. Store only the latest run payload in `sessionStorage` when opening or refreshing the separate output page; never use `localStorage` or IndexedDB for source code.
- Model each file as `{name, content}` and infer its mode from the extension. The file explorer, tabs, editor, settings, downloads, and runners all consume this state.
- Resolve HTML-local `<link rel="stylesheet">` and `<script src>` references against the in-memory project, including normalized relative paths. Inline missing-file warnings in the console. Inline CSS and JavaScript into a generated `srcdoc` payload so the preview never depends on virtual files existing on the host filesystem.
- Render preview code in an iframe with `sandbox="allow-scripts"` and a `postMessage` bridge for console messages, errors, and execution completion. The iframe is isolated from the editor DOM and does not receive same-origin access.
- Use the same runner for same-page preview and `output.html`. The output page validates the transferred project payload, renders web projects, and uses a terminal presentation for Python results. It can rerun the latest session payload after a refresh.
- Load Pyodide lazily from its official CDN for Python. Capture stdout/stderr, show tracebacks, provide a practical input prompt bridge, disable or stop execution where feasible, and describe the browser-runtime limitations in the UI.
- Build the download experience with the browser `Blob` API and a small store-only ZIP writer implemented locally, avoiding a runtime dependency for project export.

## Project structure

```text
codeplay/
├── index.html                 # Editor page
├── output.html                # Separate output page
├── css/style.css              # Shared responsive application styling
├── js/app.js                  # Editor boot, state, UI events, settings, session lifecycle
├── js/editor.js               # CodeMirror setup and textarea fallback
├── js/runner.js               # Web project resolver, iframe sandbox, console bridge
├── js/file-manager.js         # Project files, templates, file CRUD, ZIP/download helpers
├── js/output.js               # Output-page message validation and rendering
├── js/python-runner.js        # Lazy Pyodide execution and input/output handling
├── manus-routes.json          # Static route manifest for Webdev tooling
├── plan.md                    # This plan and design system
├── TODO.md                    # Outcome-based requirements and progress
└── README.md                  # GitHub Pages deployment and usage guide
```

## Design direction

Three possible directions were considered:

- **Terminal Atelier** — quiet editor chrome, ink-black workspace, electric green actions, and warm paper-like light mode. Probability: 0.06.
- **Neon Circuit** — high-contrast cyberpunk surfaces, bright gradients, and animated scanlines. Probability: 0.03.
- **Swiss Code Desk** — disciplined neutral panels, strict alignment, and restrained signal colors. Probability: 0.08.

### Chosen direction: Terminal Atelier

- **Design movement:** editorial developer tooling with the calm focus of a terminal and the warmth of a well-made notebook.
- **Core principles:** readable first; action-oriented hierarchy; quiet surfaces with precise signal color; progressive disclosure for advanced controls.
- **Color philosophy:** deep graphite and soft cloud neutrals establish a focused workspace; one ownable acid-mint green marks execution and success; amber and red are reserved for attention and errors.
- **Layout paradigm:** a command rail anchors the top, a narrow file spine controls navigation, and a flexible workbench lets editor and preview panels breathe rather than forcing equal cards.
- **Signature elements:** mint execution rail, compact monospaced metadata labels, and a warm “session” badge that makes temporary in-browser work explicit.
- **Interaction philosophy:** every destructive action asks first; every run reports what happened; controls stay close to the object they affect; hover states explain rather than decorate.
- **Animation:** short 120–180ms fades and width transitions only for panel changes, status updates, and dialogs; no looping motion except a subtle runtime pulse while work is active.
- **Typography system:** `Inter` for interface copy and `JetBrains Mono` for code, metadata, tabs, and output. Strong page title, compact uppercase section labels, comfortable code line-height.
- **Brand essence:** a private, approachable code bench for learning and prototyping in the browser; focused, capable, transparent.
- **Brand voice:** direct and encouraging. Example lines: “Run the file you’re looking at.” and “Your session stays in this browser.”
- **Wordmark & logo:** a small bracket mark made from `{` and `>` around a mint square, paired with the Code Playground wordmark.
- **Signature brand color:** `#b8f36b`, a fresh acid-mint that reads as execution without feeling like a generic success green.

## Delivery workflow

1. Implement the static files and route manifest.
2. Start a port-3000 static server for Preview and verify `index.html`, `output.html`, and `manus-routes.json` respond correctly.
3. Exercise the application with code inspection and lightweight browser smoke checks: file switching, editor updates, HTML/CSS/JavaScript connected preview, Python runner initialization path, separate output transfer path, settings, clear confirmation, and downloads.
4. Resolve diagnostics and document any browser/runtime limitations in the README and UI.
5. Commit the complete static project to the managed repository checkpoint.
