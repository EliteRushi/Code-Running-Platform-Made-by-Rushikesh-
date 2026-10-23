import { PlaygroundEditor } from './editor.js';
import { buildWebDocument, connectPreview, formatPreviewEvent, stopPreview } from './runner.js';
import { runPython, stopPython, pythonSupportNote } from './python-runner.js';
import { cloneFiles, downloadProject, downloadTextFile, findFirstFile, getDefaultFiles, getFile, getFileMeta, getLanguageLabel, inferStarterContent, normalizeFileName, validateFileName } from './file-manager.js';

const $ = selector => document.querySelector(selector);
const state = {
  files: getDefaultFiles(),
  activeFile: 'index.html',
  openFiles: ['index.html', 'style.css', 'script.js'],
  dirty: false,
  console: [],
  consoleTab: 'console',
  previewCleanup: null,
  currentPayload: null,
  pythonRunning: false,
  fileDialogMode: 'new',
  editingFileName: null,
  settings: {
    theme: 'dark', fontSize: 14, wordWrap: false, lineNumbers: true, autosave: 'disabled', outputMode: 'same', layout: 'horizontal', defaultLanguage: 'html'
  }
};

const editorHost = $('#code-editor');
const editorEmpty = $('#editor-empty');
const editor = new PlaygroundEditor(editorHost, value => {
  const file = getFile(state.files, state.activeFile);
  if (!file) return;
  file.content = value;
  state.dirty = true;
  $('#dirty-indicator').hidden = false;
  const active = document.querySelector('.file-item.active');
  active?.querySelector('.file-modified')?.removeAttribute('hidden');
}, (line, column) => {
  $('#cursor-position').textContent = `Ln ${line}, Col ${column}`;
});

const fileDialog = $('#file-dialog');
const settingsDialog = $('#settings-dialog');
const fileInput = $('#file-input');
const previewFrame = $('#preview-frame');
const terminalOutput = $('#terminal-output');
const pythonOutput = $('#python-output-text');
const stopButton = document.createElement('button');
stopButton.id = 'stop-btn'; stopButton.className = 'text-button danger-text'; stopButton.textContent = 'Stop'; stopButton.hidden = true;
$('.console-actions').prepend(stopButton);

function projectPayload() {
  syncEditor();
  return { type: 'code-playground:project', version: 1, files: cloneFiles(state.files), activeFile: state.activeFile, settings: { ...state.settings }, timestamp: Date.now() };
}

function syncEditor() {
  const file = getFile(state.files, state.activeFile);
  if (file && editorHost.offsetParent !== null) file.content = editor.getValue();
}

function renderFileTree() {
  const list = $('#file-list');
  list.replaceChildren();
  const root = document.createElement('div'); root.className = 'file-tree-root'; root.innerHTML = '<span>⌄</span> My Project'; list.append(root);
  const sorted = [...state.files].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of sorted) {
    const meta = getFileMeta(file.name);
    const row = document.createElement('div'); row.className = 'file-item' + (file.name === state.activeFile ? ' active' : ''); row.setAttribute('role', 'treeitem'); row.tabIndex = 0;
    const button = document.createElement('button'); button.className = 'file-item'; button.style.padding = '0'; button.style.width = '100%'; button.setAttribute('aria-label', `Open ${file.name}`);
    const glyph = document.createElement('span'); glyph.className = `file-glyph ${meta.language === 'javascript' ? 'js' : meta.language}`; glyph.textContent = meta.glyph;
    const name = document.createElement('span'); name.className = 'file-name'; name.textContent = file.name;
    const modified = document.createElement('span'); modified.className = 'file-modified'; modified.title = 'Unsaved changes'; modified.hidden = !state.dirty || file.name !== state.activeFile;
    const actions = document.createElement('span'); actions.className = 'file-item-actions';
    const rename = document.createElement('button'); rename.className = 'file-mini-action'; rename.title = 'Rename file'; rename.textContent = '✎'; rename.addEventListener('click', event => { event.stopPropagation(); openFileDialog('rename', file.name); });
    const remove = document.createElement('button'); remove.className = 'file-mini-action'; remove.title = 'Delete file'; remove.textContent = '×'; remove.addEventListener('click', event => { event.stopPropagation(); deleteFile(file.name); });
    actions.append(rename, remove);
    button.append(glyph, name, modified, actions); row.replaceChildren(button); list.append(row);
    button.addEventListener('click', () => openFile(file.name));
    button.addEventListener('keydown', event => { if (event.key === 'Enter') openFile(file.name); });
  }
  $('#file-count').textContent = `${state.files.length} ${state.files.length === 1 ? 'file' : 'files'}`;
}

function renderTabs() {
  const tabs = $('#open-tabs'); tabs.replaceChildren();
  state.openFiles = state.openFiles.filter(name => getFile(state.files, name));
  for (const name of state.openFiles) {
    const tab = document.createElement('button'); tab.className = `file-tab${name === state.activeFile ? ' active' : ''}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(name === state.activeFile));
    const meta = getFileMeta(name); const glyph = document.createElement('span'); glyph.className = `file-glyph ${meta.language === 'javascript' ? 'js' : meta.language}`; glyph.textContent = meta.glyph;
    const label = document.createElement('span'); label.textContent = name;
    const close = document.createElement('span'); close.className = 'tab-close'; close.textContent = '×'; close.title = 'Close tab';
    tab.append(glyph, label, close); tabs.append(tab);
    tab.addEventListener('click', event => { if (event.target === close) closeTab(name); else openFile(name); });
  }
}

function renderEditorState() {
  const file = getFile(state.files, state.activeFile);
  const hasFile = Boolean(file);
  editorEmpty.hidden = hasFile; editorHost.hidden = !hasFile;
  if (!hasFile) {
    $('#language-badge').textContent = '—'; $('#language-footer').textContent = 'No file'; $('#dirty-indicator').hidden = true;
    return;
  }
  const meta = getFileMeta(file.name);
  $('#language-badge').textContent = meta.label.toUpperCase(); $('#language-footer').textContent = meta.label;
  $('#dirty-indicator').hidden = !state.dirty;
}

function renderConsole() {
  const body = $('#console-body'); body.replaceChildren();
  const entries = state.console.filter(entry => state.consoleTab === 'errors' ? entry.level === 'error' : state.consoleTab === 'status' ? ['info', 'success', 'warn'].includes(entry.level) : true);
  if (!entries.length) { const empty = document.createElement('div'); empty.className = 'console-empty'; empty.textContent = state.consoleTab === 'errors' ? 'No errors recorded.' : 'Run a file to see activity here.'; body.append(empty); }
  for (const entry of entries) {
    const row = document.createElement('div'); row.className = `console-line ${entry.level}`;
    const level = document.createElement('span'); level.className = 'console-level'; level.textContent = entry.level;
    const message = document.createElement('span'); message.className = 'console-message'; message.textContent = entry.message;
    row.append(level, message); body.append(row);
  }
  $('#console-count').textContent = String(state.console.length);
  $('#error-count').textContent = String(state.console.filter(entry => entry.level === 'error').length);
}

function addLog(level, message, { silent = false } = {}) {
  state.console.push({ level, message: String(message) });
  if (!silent) renderConsole();
}

function setStatus(message, level = 'info') {
  $('#execution-status').textContent = message;
  const status = $('#run-status'); status.innerHTML = `<span class="status-dot ${level === 'error' ? 'error' : level === 'running' ? 'running' : level === 'success' ? '' : 'neutral'}"></span> ${message}`;
}

function showToast(message, kind = 'info') {
  const toast = document.createElement('div'); toast.className = `toast ${kind}`; toast.textContent = message; $('#toast-region').append(toast);
  setTimeout(() => toast.remove(), 3600);
}

function openFile(name) {
  if (!getFile(state.files, name)) return;
  syncEditor(); state.activeFile = name; if (!state.openFiles.includes(name)) state.openFiles.push(name);
  const file = getFile(state.files, name); editor.setFile(file.content, getFileMeta(name).language); editor.focus();
  renderTabs(); renderFileTree(); renderEditorState();
}

function closeTab(name) {
  state.openFiles = state.openFiles.filter(item => item !== name);
  if (state.activeFile === name) {
    const next = state.openFiles.at(-1) || state.files[0]?.name;
    state.activeFile = next || null;
    if (next) editor.setFile(getFile(state.files, next).content, getFileMeta(next).language);
  }
  renderTabs(); renderFileTree(); renderEditorState();
}

function openFileDialog(mode = 'new', fileName = '') {
  state.fileDialogMode = mode; state.editingFileName = fileName;
  $('#file-dialog-title').textContent = mode === 'rename' ? 'Rename file' : 'New file'; $('#file-submit-btn').textContent = mode === 'rename' ? 'Rename file' : 'Create file';
  const input = $('#file-name-input'); input.value = fileName; input.select(); fileDialog.showModal();
}

function createOrRenameFile() {
  const result = validateFileName($('#file-name-input').value);
  if (!result.ok) { showToast(result.message, 'error'); return; }
  const name = result.name;
  if (state.fileDialogMode === 'rename') {
    const existing = getFile(state.files, state.editingFileName);
    if (!existing) return;
    if (getFile(state.files, name) && name !== state.editingFileName) { showToast('A file with that name already exists.', 'error'); return; }
    existing.name = name; state.openFiles = state.openFiles.map(item => item === state.editingFileName ? name : item); state.activeFile = name; state.dirty = true;
    addLog('info', `Renamed ${state.editingFileName} to ${name}.`);
  } else {
    if (getFile(state.files, name)) { showToast('A file with that name already exists.', 'error'); return; }
    state.files.push({ name, content: inferStarterContent(name, state.settings.defaultLanguage) }); state.activeFile = name; if (!state.openFiles.includes(name)) state.openFiles.push(name); state.dirty = true;
    addLog('info', `Created ${name}.`);
  }
  const file = getFile(state.files, state.activeFile); editor.setFile(file.content, getFileMeta(file.name).language); renderTabs(); renderFileTree(); renderEditorState(); fileDialog.close();
}

function deleteFile(name) {
  if (!confirm(`Delete ${name}? This removes it from the current session.`)) return;
  state.files = state.files.filter(file => file.name !== name); state.openFiles = state.openFiles.filter(item => item !== name);
  if (state.activeFile === name) { state.activeFile = state.openFiles.at(-1) || state.files[0]?.name || null; if (state.activeFile) editor.setFile(getFile(state.files, state.activeFile).content, getFileMeta(state.activeFile).language); }
  state.dirty = true; addLog('warn', `Deleted ${name}.`); renderTabs(); renderFileTree(); renderEditorState();
}

function clearProject() {
  if (!confirm('Clear every file in the current project? This cannot be undone.')) return;
  state.files = []; state.openFiles = []; state.activeFile = null; state.dirty = false; editor.setFile('', 'plaintext'); addLog('warn', 'Project cleared.'); renderTabs(); renderFileTree(); renderEditorState(); setStatus('Ready', 'idle');
}

function resetProject() {
  if (!confirm('Reset the project to the welcome files? Your current session changes will be discarded.')) return;
  state.files = getDefaultFiles(); state.openFiles = ['index.html', 'style.css', 'script.js']; state.activeFile = 'index.html'; state.dirty = false; editor.setFile(getFile(state.files, state.activeFile).content, 'html'); addLog('info', 'Welcome project restored.'); renderTabs(); renderFileTree(); renderEditorState();
}

async function handleUpload(event) {
  const files = [...event.target.files];
  for (const raw of files) {
    const validation = validateFileName(raw.name);
    if (!validation.ok) { addLog('warn', `${raw.name}: ${validation.message}`); continue; }
    const content = await raw.text(); const existing = getFile(state.files, validation.name);
    if (existing && !confirm(`Replace ${validation.name}?`)) continue;
    if (existing) existing.content = content; else state.files.push({ name: validation.name, content });
    state.activeFile = validation.name; if (!state.openFiles.includes(validation.name)) state.openFiles.push(validation.name);
  }
  if (state.activeFile) editor.setFile(getFile(state.files, state.activeFile).content, getFileMeta(state.activeFile).language);
  state.dirty = true; renderTabs(); renderFileTree(); renderEditorState(); fileInput.value = '';
}

function showWebPreview(payload) {
  const plan = buildWebDocument({ files: payload.files, selectedFile: payload.activeFile });
  for (const warning of plan.warnings) addLog('warn', warning);
  state.previewCleanup?.(); state.previewCleanup = connectPreview(previewFrame, plan.token, data => {
    const result = formatPreviewEvent(data); addLog(result.level, result.message); if (data.kind === 'ready') setStatus('Preview updated', 'success');
  });
  $('#preview-empty').hidden = true; terminalOutput.hidden = true; previewFrame.hidden = false; previewFrame.srcdoc = plan.html; setStatus('Running preview…', 'running');
  setTimeout(() => { if ($('#run-status').textContent.includes('Running')) setStatus('Preview active', 'success'); }, 900);
}

async function showPythonPreview(payload) {
  state.previewCleanup?.(); state.previewCleanup = null; previewFrame.hidden = true; $('#preview-empty').hidden = true; terminalOutput.hidden = false; pythonOutput.textContent = ''; $('#python-runtime-status').textContent = 'Starting…';
  state.pythonRunning = true; stopButton.hidden = false; setStatus('Running Python…', 'running'); addLog('info', `Running ${payload.activeFile}.`); addLog('info', pythonSupportNote());
  const result = await runPython(getFile(payload.files, payload.activeFile)?.content || '', {
    onOutput: (text, stream) => { pythonOutput.textContent += text; addLog(stream === 'stderr' ? 'error' : 'info', text, { silent: true }); renderConsole(); },
    onStatus: message => { $('#python-runtime-status').textContent = message; addLog('info', message); },
    onError: error => addLog('error', error)
  });
  state.pythonRunning = false; stopButton.hidden = true;
  if (result.stopped) { $('#python-runtime-status').textContent = 'Stopped'; setStatus('Execution stopped', 'idle'); addLog('warn', 'Python execution stopped.'); }
  else if (result.error) { $('#python-runtime-status').textContent = 'Error'; setStatus('Python error', 'error'); }
  else { $('#python-runtime-status').textContent = 'Completed'; setStatus('Execution completed', 'success'); addLog('success', 'Python execution completed.'); }
}

async function runPayload(payload, { forceSamePage = false } = {}) {
  if (!payload.files.length) { showToast('Create or open a file before running code.', 'warn'); addLog('warn', 'No files to run.'); return; }
  state.currentPayload = payload; addLog('info', `Running ${payload.activeFile || 'project'}.`);
  const extension = payload.activeFile?.split('.').pop().toLowerCase();
  if (extension === 'py') await showPythonPreview(payload); else showWebPreview(payload);
}

function launchOutput(payload) {
  state.currentPayload = payload;
  try { sessionStorage.setItem('code-playground:last-run', JSON.stringify(payload)); } catch (error) { addLog('warn', `Temporary output handoff unavailable: ${error.message}`); }
  const outputUrl = new URL('./output.html', location.href).href; const tab = window.open(outputUrl, '_blank');
  if (!tab) { showToast('The output tab was blocked. Allow pop-ups for this site.', 'error'); return; }
  const targetOrigin = location.origin;
  [100, 350, 800, 1500].forEach(delay => setTimeout(() => { try { tab.postMessage(payload, targetOrigin); } catch (_) {} }, delay));
  addLog('success', 'Output page opened in a new tab.');
}

async function handleRun({ separate = false } = {}) {
  syncEditor(); const payload = projectPayload();
  if (separate || state.settings.outputMode === 'separate') { launchOutput(payload); return; }
  await runPayload(payload);
}

function applySettings() {
  document.body.dataset.theme = state.settings.theme; document.documentElement.style.setProperty('--code-size', `${state.settings.fontSize}px`);
  $('#setting-theme').value = state.settings.theme; $('#setting-font-size').value = state.settings.fontSize; $('#font-size-output').textContent = `${state.settings.fontSize}px`; $('#setting-word-wrap').checked = state.settings.wordWrap; $('#setting-line-numbers').checked = state.settings.lineNumbers; $('#setting-autosave').value = state.settings.autosave; $('#setting-output-mode').value = state.settings.outputMode; $('#setting-layout').value = state.settings.layout; $('#setting-language').value = state.settings.defaultLanguage;
  $('#workspace').classList.toggle('layout-vertical', state.settings.layout === 'vertical');
  editor.updateConfig({ theme: state.settings.theme, fontSize: state.settings.fontSize, wordWrap: state.settings.wordWrap, lineNumbers: state.settings.lineNumbers });
}

function openSettings() { applySettings(); settingsDialog.showModal(); }

function configureResizers() {
  document.querySelectorAll('.resize-handle').forEach(handle => {
    let dragging = false;
    handle.addEventListener('pointerdown', event => { dragging = true; handle.setPointerCapture(event.pointerId); document.body.style.cursor = handle.dataset.resize === 'preview' && state.settings.layout === 'vertical' ? 'row-resize' : 'col-resize'; });
    handle.addEventListener('pointermove', event => {
      if (!dragging || window.innerWidth < 781) return;
      const workspace = $('#workspace').getBoundingClientRect();
      if (handle.dataset.resize === 'files') {
        const width = Math.max(150, Math.min(340, event.clientX - workspace.left)); document.documentElement.style.setProperty('--files-width', `${width}px`);
      } else if (state.settings.layout === 'vertical') {
        const height = Math.max(220, Math.min(workspace.height - 250, event.clientY - workspace.top)); $('#workspace').style.gridTemplateRows = `${height}px 7px minmax(220px, 1fr)`;
      } else {
        const rightWidth = Math.max(260, Math.min(workspace.width - 420, workspace.right - event.clientX)); document.documentElement.style.setProperty('--preview-width', `${rightWidth}px`);
      }
    });
    handle.addEventListener('pointerup', () => { dragging = false; document.body.style.cursor = ''; });
    handle.addEventListener('pointercancel', () => { dragging = false; document.body.style.cursor = ''; });
  });
}

function initEvents() {
  $('#home-btn').addEventListener('click', () => { state.activeFile = 'index.html'; openFile('index.html'); });
  $('#new-file-btn').addEventListener('click', () => openFileDialog()); $('#explorer-new-btn').addEventListener('click', () => openFileDialog()); $('#empty-new-btn').addEventListener('click', () => openFileDialog());
  $('#open-file-btn').addEventListener('click', () => fileInput.click()); fileInput.addEventListener('change', handleUpload); $('#save-file-btn').addEventListener('click', () => { syncEditor(); const file = getFile(state.files, state.activeFile); if (file) downloadTextFile(file.name, file.content); }); $('#download-project-btn').addEventListener('click', async () => { syncEditor(); if (!state.files.length) { showToast('There are no files to download.', 'warn'); return; } await downloadProject(state.files); showToast('Project ZIP downloaded.'); });
  $('#run-btn').addEventListener('click', () => handleRun()); $('#preview-run-btn').addEventListener('click', () => handleRun()); $('#open-output-btn').addEventListener('click', () => { syncEditor(); launchOutput(projectPayload()); }); $('#reset-btn').addEventListener('click', resetProject); $('#clear-project-btn').addEventListener('click', clearProject); $('#refresh-preview-btn').addEventListener('click', () => state.currentPayload ? runPayload(state.currentPayload) : handleRun());
  $('#theme-toggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applySettings(); }); $('#settings-btn').addEventListener('click', openSettings);
  $('#file-form').addEventListener('submit', event => { event.preventDefault(); createOrRenameFile(); }); fileDialog.addEventListener('close', () => { if (fileDialog.returnValue === 'default') createOrRenameFile(); });
  $('#settings-form').addEventListener('change', event => {
    const id = event.target.id; const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    if (id === 'setting-theme') state.settings.theme = value; if (id === 'setting-font-size') state.settings.fontSize = Number(value); if (id === 'setting-word-wrap') state.settings.wordWrap = value; if (id === 'setting-line-numbers') state.settings.lineNumbers = value; if (id === 'setting-autosave') state.settings.autosave = value; if (id === 'setting-output-mode') state.settings.outputMode = value; if (id === 'setting-layout') state.settings.layout = value; if (id === 'setting-language') state.settings.defaultLanguage = value; applySettings();
  }); $('#setting-font-size').addEventListener('input', event => { state.settings.fontSize = Number(event.target.value); applySettings(); });
  document.querySelectorAll('[data-console-tab]').forEach(tab => tab.addEventListener('click', () => { state.consoleTab = tab.dataset.consoleTab; document.querySelectorAll('[data-console-tab]').forEach(item => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', String(item === tab)); }); renderConsole(); }));
  $('#clear-console-btn').addEventListener('click', () => { state.console = []; renderConsole(); }); $('#copy-console-btn').addEventListener('click', async () => { const text = state.console.map(item => `[${item.level.toUpperCase()}] ${item.message}`).join('\n'); try { await navigator.clipboard.writeText(text); showToast('Console copied.'); } catch (_) { showToast('Clipboard access was unavailable.', 'warn'); } }); $('#toggle-console-btn').addEventListener('click', () => { document.body.classList.toggle('console-collapsed'); $('#toggle-console-btn').textContent = document.body.classList.contains('console-collapsed') ? 'Show' : 'Hide'; });
  stopButton.addEventListener('click', () => { if (state.pythonRunning) { stopPython(); addLog('warn', 'Stop requested for Python.'); } else { stopPreview(previewFrame); setStatus('Preview stopped', 'idle'); } });
  window.addEventListener('message', event => { if (event.origin !== location.origin || event.data?.type !== 'code-playground:output-ready' || !state.currentPayload) return; try { event.source?.postMessage(state.currentPayload, location.origin); } catch (_) {} });
  document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); handleRun(); } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('#save-file-btn').click(); } });
  configureResizers();
}

async function init() {
  initEvents(); renderFileTree(); renderTabs(); renderEditorState(); renderConsole(); applySettings();
  await editor.mount(getFile(state.files, state.activeFile).content, { mode: 'html', ...state.settings });
  editor.focus(); addLog('info', 'Welcome project loaded.'); addLog('info', 'Your source stays in this browser session.'); renderConsole();
}

init().catch(error => { addLog('error', `Editor initialization failed: ${error.message}`); setStatus('Initialization error', 'error'); renderConsole(); });
