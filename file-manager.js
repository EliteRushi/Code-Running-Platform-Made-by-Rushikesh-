const DEFAULT_FILES = [
  {
    name: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Website</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="hero">
    <p class="eyebrow">Code Playground</p>
    <h1>Hello World!</h1>
    <p>Welcome to Code Playground.</p>
    <button id="myButton">Click me</button>
    <p id="message" class="message" aria-live="polite"></p>
  </main>
  <script src="script.js"></script>
</body>
</html>`
  },
  {
    name: 'style.css',
    content: `:root {
  font-family: Inter, system-ui, sans-serif;
  color: #17200f;
  background: #f5f5f5;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  text-align: center;
  background: #f5f5f5;
}

.hero {
  padding: 48px;
}

.eyebrow {
  color: #6caa29;
  font: 700 12px/1.2 monospace;
  letter-spacing: .12em;
  text-transform: uppercase;
}

h1 {
  color: #4c8618;
  font-size: clamp(2.4rem, 8vw, 5rem);
  margin: 10px 0;
}

button {
  border: 0;
  border-radius: 999px;
  padding: 11px 20px;
  color: #17200f;
  background: #b8f36b;
  cursor: pointer;
  font-weight: 700;
}

button:hover { background: #9bdb4f; }
.message { min-height: 1.5em; color: #4c8618; }`
  },
  {
    name: 'script.js',
    content: `const button = document.getElementById('myButton');
const message = document.getElementById('message');

button.addEventListener('click', () => {
  message.textContent = 'Connected files are working!';
  console.log('The button was clicked.');
});`
  },
  {
    name: 'main.py',
    content: `print("Hello World from Python!")
for i in range(1, 6):
    print(i)`
  }
];

const EXTENSIONS = {
  html: { language: 'html', label: 'HTML', glyph: 'HTML' },
  htm: { language: 'html', label: 'HTML', glyph: 'HTML' },
  css: { language: 'css', label: 'CSS', glyph: 'CSS' },
  js: { language: 'javascript', label: 'JavaScript', glyph: 'JS' },
  mjs: { language: 'javascript', label: 'JavaScript', glyph: 'JS' },
  py: { language: 'python', label: 'Python', glyph: 'PY' }
};

export function cloneFiles(files = DEFAULT_FILES) {
  return files.map(file => ({ name: file.name, content: String(file.content ?? '') }));
}

export function getDefaultFiles() { return cloneFiles(DEFAULT_FILES); }

export function getExtension(name = '') {
  const clean = name.split('/').pop().toLowerCase();
  return clean.includes('.') ? clean.split('.').pop() : '';
}

export function getFileMeta(name = '') {
  return EXTENSIONS[getExtension(name)] || { language: 'plaintext', label: 'Text', glyph: 'TXT' };
}

export function getLanguageLabel(name) { return getFileMeta(name).label; }

export function getFile(files, name) { return files.find(file => file.name === name) || null; }

export function findFirstFile(files, extension) {
  return files.find(file => getExtension(file.name) === extension) || null;
}

export function isSupportedFile(name) { return Boolean(EXTENSIONS[getExtension(name)]); }

export function normalizePath(path = '') {
  const pieces = String(path).replaceAll('\\', '/').split('/');
  const result = [];
  for (const piece of pieces) {
    if (!piece || piece === '.') continue;
    if (piece === '..') result.pop();
    else result.push(piece);
  }
  return result.join('/');
}

export function resolveProjectPath(reference, baseFile = '') {
  const cleanReference = String(reference || '').split(/[?#]/)[0].trim();
  if (!cleanReference) return '';
  if (/^(?:[a-z]+:|\/\/|data:|#)/i.test(cleanReference)) return cleanReference;
  if (cleanReference.startsWith('/')) return normalizePath(cleanReference);
  const basePieces = normalizePath(baseFile).split('/');
  basePieces.pop();
  return normalizePath([...basePieces, cleanReference].join('/'));
}

export function normalizeFileName(input) {
  let name = String(input || '').trim().replaceAll('\\', '/').replace(/^\/+/, '');
  name = normalizePath(name);
  return name;
}

export function validateFileName(input) {
  const name = normalizeFileName(input);
  if (!name) return { ok: false, message: 'Enter a file name.' };
  if (!isSupportedFile(name)) return { ok: false, message: 'Use an .html, .css, .js, or .py extension.' };
  if (name.split('/').some(part => part.startsWith('.'))) return { ok: false, message: 'Hidden file names are not supported.' };
  return { ok: true, name };
}

export function inferStarterContent(name, defaultLanguage = 'html') {
  const ext = getExtension(name);
  if (ext === 'html' || ext === 'htm') return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>New page</title>\n</head>\n<body>\n  <h1>New page</h1>\n</body>\n</html>';
  if (ext === 'css') return 'body {\n  font-family: system-ui, sans-serif;\n}\n';
  if (ext === 'js' || ext === 'mjs') return 'console.log("Hello from JavaScript!");\n';
  if (ext === 'py') return 'print("Hello from Python!")\n';
  if (defaultLanguage === 'python') return 'print("Hello from Python!")\n';
  return '';
}

export function downloadTextFile(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, name);
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.split('/').pop() || 'download';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }

export async function createZipBlob(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const local = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(local);
    writeU32(localView, 0, 0x04034b50); writeU16(localView, 4, 20); writeU16(localView, 6, 0x800); writeU16(localView, 8, 0); writeU16(localView, 10, 0); writeU16(localView, 12, 0);
    writeU32(localView, 14, crc); writeU32(localView, 18, contentBytes.length); writeU32(localView, 22, contentBytes.length); writeU16(localView, 26, nameBytes.length); writeU16(localView, 28, 0);
    new Uint8Array(local, 30).set(nameBytes);
    chunks.push(new Uint8Array(local), contentBytes);
    const centralEntry = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralEntry);
    writeU32(centralView, 0, 0x02014b50); writeU16(centralView, 4, 20); writeU16(centralView, 6, 20); writeU16(centralView, 8, 0x800); writeU16(centralView, 10, 0); writeU16(centralView, 12, 0); writeU16(centralView, 14, 0); writeU32(centralView, 16, crc); writeU32(centralView, 20, contentBytes.length); writeU32(centralView, 24, contentBytes.length); writeU16(centralView, 28, nameBytes.length); writeU16(centralView, 30, 0); writeU16(centralView, 32, 0); writeU16(centralView, 34, 0); writeU16(centralView, 36, 0); writeU32(centralView, 38, 0); writeU32(centralView, 42, offset);
    new Uint8Array(centralEntry, 46).set(nameBytes);
    central.push(new Uint8Array(centralEntry));
    offset += local.byteLength + contentBytes.length;
  }
  const centralOffset = offset;
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new ArrayBuffer(22); const endView = new DataView(end);
  writeU32(endView, 0, 0x06054b50); writeU16(endView, 4, 0); writeU16(endView, 6, 0); writeU16(endView, 8, files.length); writeU16(endView, 10, files.length); writeU32(endView, 12, centralSize); writeU32(endView, 16, centralOffset); writeU16(endView, 20, 0);
  return new Blob([...chunks, ...central, new Uint8Array(end)], { type: 'application/zip' });
}

export async function downloadProject(files, projectName = 'code-playground-project') {
  const zip = await createZipBlob(files);
  triggerDownload(zip, `${projectName}.zip`);
}
