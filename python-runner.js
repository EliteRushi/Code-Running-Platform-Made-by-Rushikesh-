let pyodidePromise = null;
let pyodideInstance = null;
let interruptBuffer = null;
let currentRun = null;

const PYODIDE_VERSION = '0.26.2';
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

async function loadRuntime(onStatus) {
  if (pyodideInstance) return pyodideInstance;
  if (!pyodidePromise) {
    onStatus?.('Loading Pyodide runtime… first Python run may take a moment.');
    pyodidePromise = import(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`)
      .then(({ loadPyodide }) => loadPyodide({ indexURL: INDEX_URL }))
      .then(pyodide => {
        pyodideInstance = pyodide;
        try {
          if (typeof SharedArrayBuffer !== 'undefined') {
            interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
            pyodide.setInterruptBuffer(interruptBuffer);
          }
        } catch (error) {
          console.info('Pyodide interrupt buffer unavailable.', error);
        }
        return pyodide;
      });
  }
  return pyodidePromise;
}

export async function runPython(code, { onOutput, onStatus, onError } = {}) {
  const runId = Symbol('python-run');
  currentRun = runId;
  let pyodide;
  try {
    pyodide = await loadRuntime(onStatus);
    if (currentRun !== runId) return { stopped: true };
    if (interruptBuffer) {
      try { Atomics.store(interruptBuffer, 0, 0); } catch (_) {}
    }
    const output = [];
    pyodide.setStdout({ batched: text => { output.push(text); onOutput?.(text, 'stdout'); } });
    pyodide.setStderr({ batched: text => { output.push(text); onOutput?.(text, 'stderr'); } });
    pyodide.setStdin({ stdin: prompt => window.prompt(prompt || 'Program input:') ?? '' });
    onStatus?.('Running Python…');
    await pyodide.runPythonAsync(String(code));
    if (currentRun !== runId) return { output: output.join(''), stopped: true };
    onStatus?.('Execution completed successfully.');
    return { output: output.join(''), stopped: false };
  } catch (error) {
    if (currentRun !== runId) return { stopped: true };
    const message = error?.message || String(error);
    onError?.(message);
    onStatus?.('Execution failed.');
    return { output: '', error: message, stopped: false };
  } finally {
    if (currentRun === runId) currentRun = null;
  }
}

export function stopPython() {
  if (interruptBuffer) {
    try { Atomics.store(interruptBuffer, 0, 2); } catch (_) {}
  }
  currentRun = null;
}

export function isPythonReady() { return Boolean(pyodideInstance); }

export function pythonSupportNote() {
  return 'Python runs locally through Pyodide. Native packages, operating-system processes, and unrestricted filesystem access are not available.';
}
