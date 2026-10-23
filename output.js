import { buildWebDocument, connectPreview, formatPreviewEvent, stopPreview } from './runner.js';
import { getFile, getExtension, cloneFiles } from './file-manager.js';
import { runPython, stopPython, pythonSupportNote } from './python-runner.js';

const $ = selector => document.querySelector(selector);
const state = { payload: null, entries: [], tab: 'console', cleanup: null, pythonRunning: false };
const frame = $('#output-frame'); const terminal = $('#output-terminal'); const terminalText = $('#output-python-text'); const stopButton = document.createElement('button');
stopButton.className = 'text-button danger-text'; stopButton.textContent = 'Stop'; stopButton.hidden = true; $('.console-actions').prepend(stopButton);

function validPayload(value) {
  if (!value || value.type !== 'code-playground:project' || value.version !== 1 || !Array.isArray(value.files)) return false;
  if (value.files.length > 500) return false;
  return value.files.every(file => file && typeof file.name === 'string' && typeof file.content === 'string' && file.name.length < 300 && file.content.length < 5_000_000);
}

function log(level, message) { state.entries.push({ level, message: String(message) }); renderConsole(); }
function renderConsole() {
  const body = $('#output-console-body'); body.replaceChildren(); const entries = state.entries.filter(item => state.tab === 'errors' ? item.level === 'error' : true);
  if (!entries.length) { const empty = document.createElement('div'); empty.className = 'console-empty'; empty.textContent = state.tab === 'errors' ? 'No errors recorded.' : 'No output messages yet.'; body.append(empty); }
  entries.forEach(item => { const row = document.createElement('div'); row.className = `console-line ${item.level}`; const level = document.createElement('span'); level.className = 'console-level'; level.textContent = item.level; const text = document.createElement('span'); text.className = 'console-message'; text.textContent = item.message; row.append(level, text); body.append(row); });
  $('#output-console-count').textContent = String(state.entries.length); $('#output-error-count').textContent = String(state.entries.filter(item => item.level === 'error').length);
}
function setOutputStatus(message, level = 'info') { $('#output-status').innerHTML = `<span class="status-dot ${level === 'error' ? 'error' : level === 'running' ? 'running' : level === 'success' ? '' : 'neutral'}"></span> ${message}`; }
function showToast(message, kind = 'info') { const toast = document.createElement('div'); toast.className = `toast ${kind}`; toast.textContent = message; $('#toast-region').append(toast); setTimeout(() => toast.remove(), 3500); }

async function renderPayload(payload) {
  if (!validPayload(payload)) { showToast('The output payload is missing or invalid.', 'error'); log('error', 'Invalid or missing project payload.'); return; }
  state.payload = { ...payload, files: cloneFiles(payload.files) }; state.entries = []; document.body.dataset.theme = payload.settings?.theme === 'light' ? 'light' : 'dark';
  const activeFile = getFile(state.payload.files, state.payload.activeFile) || state.payload.files[0]; $('#output-title').textContent = activeFile ? activeFile.name : 'Project output';
  const extension = getExtension(activeFile?.name || '');
  state.cleanup?.(); state.cleanup = null; stopButton.hidden = false;
  if (extension === 'py') {
    frame.hidden = true; $('#output-empty').hidden = true; terminal.hidden = false; terminalText.textContent = ''; state.pythonRunning = true; setOutputStatus('Running Python…', 'running'); log('info', `Running ${activeFile.name}.`); log('info', pythonSupportNote()); $('#output-python-status').textContent = 'Starting…';
    const result = await runPython(activeFile.content, { onOutput: (text, stream) => { terminalText.textContent += text; log(stream === 'stderr' ? 'error' : 'info', text); }, onStatus: message => { $('#output-python-status').textContent = message; log('info', message); }, onError: message => log('error', message) });
    state.pythonRunning = false; stopButton.hidden = true;
    if (result.stopped) { setOutputStatus('Execution stopped', 'info'); $('#output-python-status').textContent = 'Stopped'; }
    else if (result.error) { setOutputStatus('Python error', 'error'); $('#output-python-status').textContent = 'Error'; }
    else { setOutputStatus('Execution completed', 'success'); $('#output-python-status').textContent = 'Completed'; log('success', 'Python execution completed.'); }
    return;
  }
  terminal.hidden = true; $('#output-empty').hidden = true; frame.hidden = false; setOutputStatus('Running preview…', 'running');
  const plan = buildWebDocument({ files: state.payload.files, selectedFile: activeFile?.name }); plan.warnings.forEach(item => log('warn', item)); state.cleanup = connectPreview(frame, plan.token, data => { const result = formatPreviewEvent(data); log(result.level, result.message); if (data.kind === 'ready') setOutputStatus('Preview active', 'success'); }); frame.srcdoc = plan.html;
}

function readStored() {
  try { const raw = sessionStorage.getItem('code-playground:last-run'); return raw ? JSON.parse(raw) : null; } catch (error) { log('warn', `Could not read the temporary output session: ${error.message}`); return null; }
}

window.addEventListener('message', event => {
  if (event.source !== window.opener) return;
  if (event.origin !== location.origin) return;
  if (validPayload(event.data)) { try { sessionStorage.setItem('code-playground:last-run', JSON.stringify(event.data)); } catch (_) {} renderPayload(event.data); }
});

$('#output-refresh-btn').addEventListener('click', () => { const payload = state.payload || readStored(); if (payload) renderPayload(payload); else showToast('There is no transferred project to refresh.', 'warn'); });
$('#output-clear-btn').addEventListener('click', () => { state.entries = []; renderConsole(); });
$('#output-copy-btn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.entries.map(item => `[${item.level.toUpperCase()}] ${item.message}`).join('\n')); showToast('Output console copied.'); } catch (_) { showToast('Clipboard access was unavailable.', 'warn'); } });
document.querySelectorAll('[data-output-tab]').forEach(tab => tab.addEventListener('click', () => { state.tab = tab.dataset.outputTab; document.querySelectorAll('[data-output-tab]').forEach(item => item.classList.toggle('active', item === tab)); renderConsole(); }));
stopButton.addEventListener('click', () => { if (state.pythonRunning) { stopPython(); log('warn', 'Stop requested for Python.'); } else { stopPreview(frame); setOutputStatus('Preview stopped'); } });

const readyMessage = { type: 'code-playground:output-ready' };
try { window.opener?.postMessage(readyMessage, location.origin); } catch (_) {}
const initial = readStored();
if (initial) renderPayload(initial); else renderConsole();
