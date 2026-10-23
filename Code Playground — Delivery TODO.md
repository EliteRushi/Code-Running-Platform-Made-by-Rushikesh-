# Code Playground — Delivery TODO

## Editor shell and responsive interface

- [x] Deliver `index.html` as the main Code Playground editor page with a compact header containing the logo, Home, New File, Open File, Save File, Run Code, Reset Code, Theme toggle, Settings, and Clear Project actions.
- [x] Use a modern minimalist developer-tool design with subtle borders, rounded panels, readable monospace code, clear file tabs, minimal animations, professional spacing, a prominent green Run Code button, and responsive behavior.
- [x] Provide a three-panel desktop layout for file explorer, code editor, and output preview, with console/status controls below; on smaller screens provide stacked panels or usable Files, Editor, Output, and Console sections.
- [x] Allow editor and output panels to be resized and provide horizontal/vertical layout settings.

## Multi-file editing and session behavior

- [x] Support HTML (`.html`), CSS (`.css`), JavaScript (`.js`), and Python (`.py`) files. A file extension determines the editing mode and does not imply independent execution outside the selected run configuration.
- [x] Support creating, renaming, deleting, switching, and editing multiple files; open file tabs; file names entered by the user; per-file downloads; and downloading all project files together as a ZIP.
- [x] Load a default project containing connected `index.html`, `style.css`, `script.js`, and independent `main.py` examples that work immediately.
- [x] Keep source code in browser memory by default. Do not require registration, API keys, a backend, a database, cloud storage, or server-side execution. Do not automatically upload code or permanently save source code in localStorage or IndexedDB.
- [x] Provide a manual download option, a Clear Project button with confirmation, and make it clear that closing the editor ends the working session while closing a separate output tab need not erase the editor session.

## Editor experience and settings

- [x] Provide syntax highlighting, line numbers, automatic indentation, bracket matching, code completion where supported, find/replace, light/dark themes, keyboard shortcuts, and error highlighting where supported; provide a usable fallback if the editor library is unavailable.
- [x] Provide settings for Light/Dark editor theme, font size 12–24px, word wrap On/Off, line numbers On/Off, Auto-save disabled by default, Same page/Separate page output mode, Horizontal/Vertical editor layout, and HTML/CSS/JavaScript/Python default language.
- [x] Save only non-sensitive interface preferences for the current session if needed; do not automatically persist source code.

## Connected web preview and isolation

- [x] When running HTML, identify the main HTML file, collect referenced local CSS and JavaScript files, resolve relative in-memory project references, combine the resources into a runnable preview, and display the result.
- [x] Support `<link rel="stylesheet" href="style.css">` and `<script src="script.js"></script>` plus practical relative paths such as `assets/style.css` and `js/app.js`; show a useful missing-file warning when a referenced project resource is not found.
- [x] When running a CSS file, apply it to the selected/default HTML preview. When running a JavaScript file, execute it against the preview document, capture errors, and provide console output.
- [x] Run HTML and JavaScript previews in a sandboxed iframe isolated from the editor DOM, validate messages exchanged with the iframe/output page, avoid arbitrary-origin execution, restrict iframe permissions, and provide practical execution timeouts.
- [x] Warn users that external scripts/resources may download content from third-party servers.

## Python execution

- [x] When running a Python file, execute it locally in the browser through Pyodide, display standard output, errors, and tracebacks, support common Python operations and included standard libraries, and explain browser-runtime limitations.
- [x] Provide an input field or interactive input panel when Python requests `input()` where practical, avoid freezing the editor during execution, and provide a Stop button where feasible.
- [x] Do not claim that every Python program runs in this environment; programs requiring arbitrary native packages, unrestricted filesystem access, or system processes may not work.

## Output page and communication

- [x] Deliver `output.html` with a Code Output header, Back to Editor, Refresh Output, a full-width preview area, console panel, error display panel, and responsive layout.
- [x] Display HTML/CSS/JavaScript results in an iframe occupying most of the output page; display Python output in a terminal-like panel with completion status and input support.
- [x] Support same-page output and separate `/output.html` output mode. When separate output is opened, explicitly transfer the current project through a validated message protocol and/or temporary session storage; do not assume JavaScript memory is shared between pages.
- [x] On output refresh, offer rerun of the latest transferred project when it is still available in temporary browser session storage; handle missing or invalid payloads gracefully and do not execute arbitrary messages.

## Console, errors, and downloads

- [x] Display JavaScript console messages, JavaScript errors, Python output and tracebacks, missing-file warnings, execution status, and runtime initialization errors with clear INFO/SUCCESS/ERROR levels.
- [x] Provide Clear console, Copy console output, Hide/Show console, and Stop execution controls.
- [x] Export individual files and all project files without a server; provide a Clear Project confirmation flow.

## GitHub Pages delivery

- [x] Use relative asset links and no server process/runtime dependency so the site works at a GitHub Pages repository subpath over HTTPS.
- [x] Include `README.md` explaining repository creation, file upload, enabling GitHub Pages, branch/folder selection, accessing the published site, and updating the application later.
- [x] Verify HTML, CSS, JavaScript, Python, connected files, same-page output, separate output transfer, console/errors, file manager, downloads, temporary source handling, repository-subpath-safe links, and absence of backend/database requirements.
