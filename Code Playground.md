# Code Playground

Code Playground is a static browser IDE for learning and prototyping with HTML, CSS, JavaScript, and Python. It keeps the active project in browser memory, renders web projects inside a sandboxed iframe, and uses Pyodide to run Python locally in the browser. There is no backend, database, account system, or server-side code execution.

## Features

- Multi-file project workspace with create, rename, delete, switch, tabs, and file upload.
- HTML, CSS, JavaScript, and Python syntax modes with a CodeMirror editor loaded from a public CDN, plus a textarea fallback if the editor CDN is unavailable.
- Connected local resources such as `<link rel="stylesheet" href="style.css">` and `<script src="script.js"></script>` resolved from the in-memory project.
- Same-page preview or a separate `output.html` result page.
- Sandboxed web preview with console messages, JavaScript errors, missing-file warnings, and execution status.
- Lazy Pyodide Python runtime with stdout, stderr, tracebacks, browser-prompt input, and a Stop control.
- Light/dark themes, font size, wrapping, line number, layout, output mode, and default-language settings.
- Manual download of individual files or the entire project as a ZIP file.
- No automatic permanent source persistence. The editor does not write source code to `localStorage` or `IndexedDB`.

## Run locally

Any static HTTP server works. For example, from the project directory:

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000/`. Do not open the files directly with `file://`; ES modules, CodeMirror imports, Pyodide, and the separate output page work reliably over HTTP or HTTPS.

The first Python run downloads the Pyodide runtime from its official CDN. HTML/CSS/JavaScript runs without a server-side runtime, but external resources referenced by user code can still be downloaded by the browser.

## Deploy to GitHub Pages

1. Create a new repository on GitHub. A repository named `<username>.github.io` publishes at the domain root; any other repository publishes under `https://<username>.github.io/<repository-name>/`.
2. Upload the complete project directory, preserving `index.html`, `output.html`, `css/`, `js/`, and `manus-routes.json`.
3. Commit and push the files to the branch you want to publish, normally `main`.
4. Open the repository’s **Settings → Pages** page.
5. Under **Build and deployment**, choose **Deploy from a branch**, select the publishing branch and the `/ (root)` folder, then save.
6. Wait for GitHub Pages to publish the site. GitHub will show the published address in the Pages settings panel.
7. Open the site over HTTPS. Relative asset paths are used throughout the project, so the application also works under a repository subpath.

### Updating later

Edit the files locally or directly in GitHub, commit the changes, and push them to the configured Pages branch. GitHub Pages will rebuild the static site automatically. If you change only the interface, no package installation or build command is needed.

## Privacy and runtime limits

Source code is held in the active JavaScript session. The separate output page receives a temporary run payload through a validated `postMessage` and a `sessionStorage` handoff so a refresh can rerun the most recent output. Closing the editor discards its in-memory working copy; a downloaded file is, of course, retained wherever the user chose to save it.

The web preview uses a sandboxed iframe with scripts enabled but without same-origin access or navigation permissions. This is useful isolation, not a complete security boundary. Treat arbitrary HTML and JavaScript as untrusted. External scripts and stylesheets can contact third-party servers.

Pyodide provides a Python interpreter compiled for the browser. It does not provide a normal operating-system process model, unrestricted filesystem access, arbitrary native packages, or every capability of desktop Python. Long-running Python may not be interruptible in every browser because interrupt buffers depend on browser security features.

## Static file map

```text
index.html
output.html
css/style.css
js/app.js
js/editor.js
js/file-manager.js
js/runner.js
js/output.js
js/python-runner.js
manus-routes.json
README.md
```
