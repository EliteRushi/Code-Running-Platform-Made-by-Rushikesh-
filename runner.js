import { findFirstFile, getExtension, getFile, normalizePath, resolveProjectPath } from './file-manager.js';

const CHANNEL = 'code-playground-preview';
const DEFAULT_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Code Playground Preview</title></head><body><main><h1>Code Playground</h1><p>Create an HTML file to customize this preview.</p></main></body></html>`;

function escapeScript(source) { return String(source).replaceAll('</script', '<\\/script'); }
function escapeStyle(source) { return String(source).replaceAll('</style', '<\\/style'); }
function isExternal(reference) { return /^(?:https?:|data:|blob:|\/\/)/i.test(String(reference || '').trim()); }
function randomToken() { return `${crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}-${Date.now()}`; }

function bridgeScript(token) {
  return `<script>\n(() => {\n  const token = ${JSON.stringify(token)};\n  const send = (kind, payload = {}) => { try { parent.postMessage({ channel: '${CHANNEL}', token, kind, ...payload }, '*'); } catch (_) {} };\n  const stringify = value => { try { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); } catch (_) { return String(value); } };\n  ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {\n    const original = console[level];\n    console[level] = (...args) => { send('console', { level, args: args.map(stringify) }); original.apply(console, args); };\n  });\n  addEventListener('error', event => send('error', { message: event.message || 'Script error', source: event.filename || '', line: event.lineno || 0 }));\n  addEventListener('unhandledrejection', event => send('error', { message: stringify(event.reason || 'Unhandled promise rejection') }));\n  addEventListener('load', () => send('ready', { message: 'Preview ready' }));\n  send('status', { message: 'Preview booted' });\n})();\n</script>`;
}

function addBridge(html, token) {
  const bridge = bridgeScript(token);
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => `${match}${bridge}`);
  return `${bridge}${html}`;
}

function appendBefore(html, tag, addition) {
  const pattern = new RegExp(`</${tag}>`, 'i');
  return pattern.test(html) ? html.replace(pattern, `${addition}</${tag}>`) : `${html}${addition}`;
}

function injectCss(html, css, sourceName) {
  const style = `<style data-playground-source="${sourceName}">${escapeStyle(css)}</style>`;
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, match => `${match}${style}`) : style + html;
}

function injectScript(html, js, sourceName) {
  return appendBefore(html, 'body', `<script data-playground-source="${sourceName}">${escapeScript(js)}</script>`);
}

function replaceLocalResources(html, files, mainName, warnings, loaded) {
  const fileMap = new Map(files.map(file => [normalizePath(file.name), file]));
  const linkPattern = /<link\b([^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*)>/gi;
  html = html.replace(linkPattern, (full, attrs, reference) => {
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(attrs) || isExternal(reference)) {
      if (isExternal(reference)) warnings.push(`External stylesheet left in place: ${reference}`);
      return full;
    }
    const resolved = resolveProjectPath(reference, mainName);
    const file = fileMap.get(resolved) || fileMap.get(normalizePath(reference));
    if (!file || getExtension(file.name) !== 'css') {
      warnings.push(`Missing local stylesheet: ${reference}`);
      return `<!-- Missing local stylesheet: ${reference} -->`;
    }
    loaded.add(file.name);
    return `<style data-playground-source="${file.name}">${escapeStyle(file.content)}</style>`;
  });
  const scriptPattern = /<script\b([^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*)>\s*<\/script\s*>/gi;
  html = html.replace(scriptPattern, (full, attrs, reference) => {
    if (isExternal(reference)) {
      warnings.push(`External script left in place: ${reference}`);
      return full;
    }
    const resolved = resolveProjectPath(reference, mainName);
    const file = fileMap.get(resolved) || fileMap.get(normalizePath(reference));
    if (!file || !['js', 'mjs'].includes(getExtension(file.name))) {
      warnings.push(`Missing local script: ${reference}`);
      return `<!-- Missing local script: ${reference} -->`;
    }
    loaded.add(file.name);
    const safeAttrs = attrs.replace(/\bsrc\s*=\s*["'][^"']+["']/i, '').trim();
    return `<script ${safeAttrs} data-playground-source="${file.name}">${escapeScript(file.content)}</script>`;
  });
  return html;
}

export function buildWebDocument({ files, selectedFile = 'index.html' }) {
  const htmlFile = getFile(files, selectedFile)?.name.endsWith('.html') || getFile(files, selectedFile)?.name.endsWith('.htm') ? getFile(files, selectedFile) : findFirstFile(files, 'html') || findFirstFile(files, 'htm');
  const mainName = htmlFile?.name || 'index.html';
  let html = htmlFile?.content || DEFAULT_HTML;
  const warnings = [];
  const loaded = new Set();
  html = replaceLocalResources(html, files, mainName, warnings, loaded);

  const selected = getFile(files, selectedFile);
  if (selected && getExtension(selected.name) === 'css' && !loaded.has(selected.name)) html = injectCss(html, selected.content, selected.name);
  if (selected && ['js', 'mjs'].includes(getExtension(selected.name)) && !loaded.has(selected.name)) html = injectScript(html, selected.content, selected.name);

  const externalMatches = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]).filter(isExternal);
  externalMatches.forEach(reference => warnings.push(`External resource may be downloaded: ${reference}`));
  const token = randomToken();
  return { html: addBridge(html, token), token, mainName, warnings, loadedFiles: [...loaded] };
}

export function connectPreview(iframe, token, onEvent) {
  let timeout;
  const listener = event => {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.token !== token) return;
    if (data.kind === 'ready' || data.kind === 'error') window.clearTimeout(timeout);
    onEvent(data);
  };
  window.addEventListener('message', listener);
  timeout = window.setTimeout(() => onEvent({ kind: 'status', level: 'warn', message: 'Preview is still running. A long-running script may be blocking the page.' }), 8000);
  return () => { window.removeEventListener('message', listener); window.clearTimeout(timeout); };
}

export function formatPreviewEvent(data) {
  if (data.kind === 'console') return { level: data.level === 'debug' ? 'info' : data.level, message: (data.args || []).join(' ') };
  if (data.kind === 'error') return { level: 'error', message: `${data.message || 'JavaScript error'}${data.line ? ` (line ${data.line})` : ''}` };
  if (data.kind === 'ready') return { level: 'success', message: data.message || 'Preview updated' };
  return { level: data.level || 'info', message: data.message || 'Preview status updated' };
}

export function stopPreview(iframe) {
  if (iframe) iframe.srcdoc = '<!doctype html><title>Stopped</title><body style="font-family:system-ui;padding:2rem;color:#555">Preview stopped.</body>';
}
