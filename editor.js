let cmModules = null;

async function loadCodeMirror() {
  if (cmModules) return cmModules;
  const [codemirror, state, view, language, commands, search, autocomplete, html, css, javascript, python, theme] = await Promise.all([
    import('https://esm.sh/codemirror@6.0.1'),
    import('https://esm.sh/@codemirror/state@6.5.2'),
    import('https://esm.sh/@codemirror/view@6.36.5'),
    import('https://esm.sh/@codemirror/language@6.11.3'),
    import('https://esm.sh/@codemirror/commands@6.8.1'),
    import('https://esm.sh/@codemirror/search@6.5.10'),
    import('https://esm.sh/@codemirror/autocomplete@6.18.6'),
    import('https://esm.sh/@codemirror/lang-html@6.4.9'),
    import('https://esm.sh/@codemirror/lang-css@6.3.1'),
    import('https://esm.sh/@codemirror/lang-javascript@6.2.3'),
    import('https://esm.sh/@codemirror/lang-python@6.1.6'),
    import('https://esm.sh/@codemirror/theme-one-dark@6.1.2')
  ]);
  cmModules = { codemirror, state, view, language, commands, search, autocomplete, html, css, javascript, python, theme };
  return cmModules;
}

function languageExtension(modules, mode) {
  if (mode === 'html') return modules.html.html({ autoCloseTags: true });
  if (mode === 'css') return modules.css.css();
  if (mode === 'javascript') return modules.javascript.javascript({ jsx: true, typescript: false });
  if (mode === 'python') return modules.python.python();
  return [];
}

export class PlaygroundEditor {
  constructor(container, onChange, onCursor) {
    this.container = container;
    this.onChange = onChange;
    this.onCursor = onCursor;
    this.view = null;
    this.textarea = null;
    this.modules = null;
    this.isFallback = false;
    this.config = { mode: 'html', theme: 'dark', fontSize: 14, wordWrap: false, lineNumbers: true };
  }

  async mount(initialValue, config = {}) {
    this.config = { ...this.config, ...config };
    try {
      this.modules = await loadCodeMirror();
      this.mountCodeMirror(initialValue);
      return { fallback: false };
    } catch (error) {
      console.warn('CodeMirror could not load; using textarea fallback.', error);
      this.mountFallback(initialValue);
      return { fallback: true, error };
    }
  }

  mountCodeMirror(value) {
    const { state, view, language, commands, search, autocomplete, theme } = this.modules;
    const extensions = [
      this.config.lineNumbers ? view.lineNumbers() : [],
      view.highlightActiveLine(),
      view.highlightActiveLineGutter(),
      language.bracketMatching(),
      autocomplete.closeBrackets(),
      language.indentOnInput(),
      autocomplete.autocompletion(),
      commands.history(),
      view.keymap.of([commands.indentWithTab, ...commands.defaultKeymap, ...commands.historyKeymap, ...search.searchKeymap, ...autocomplete.completionKeymap]),
      search.highlightSelectionMatches(),
      view.EditorView.updateListener.of(update => {
        if (update.docChanged) this.onChange(update.state.doc.toString());
        if (update.selectionSet || update.docChanged) {
          const cursor = update.state.selection.main.head;
          const line = update.state.doc.lineAt(cursor);
          this.onCursor?.(line.number, cursor - line.from + 1);
        }
      }),
      this.config.wordWrap ? view.EditorView.lineWrapping : [],
      languageExtension(this.modules, this.config.mode),
      this.config.theme === 'dark' ? theme.oneDark : []
    ];
    this.container.replaceChildren();
    this.view = new view.EditorView({
      state: state.EditorState.create({ doc: value, extensions }),
      parent: this.container
    });
    this.applyVisualConfig();
  }

  mountFallback(value) {
    this.isFallback = true;
    this.container.replaceChildren();
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'fallback-editor';
    this.textarea.spellcheck = false;
    this.textarea.value = value;
    this.textarea.addEventListener('input', () => this.onChange(this.textarea.value));
    this.textarea.addEventListener('keyup', () => {
      const before = this.textarea.value.slice(0, this.textarea.selectionStart);
      const lines = before.split('\n');
      this.onCursor?.(lines.length, lines.at(-1).length + 1);
    });
    this.container.append(this.textarea);
    this.applyVisualConfig();
  }

  setFile(value, mode) {
    this.config.mode = mode;
    if (this.view && this.modules) {
      const { state } = this.modules;
      this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: value }, selection: { anchor: 0 } });
      this.reconfigure();
    } else if (this.textarea) {
      this.textarea.value = value;
      this.textarea.scrollTop = 0;
      this.textarea.scrollLeft = 0;
    }
    this.applyVisualConfig();
  }

  getValue() {
    if (this.view) return this.view.state.doc.toString();
    return this.textarea?.value || '';
  }

  reconfigure() {
    if (!this.view || !this.modules) return;
    const { state, view, language, commands, search, autocomplete, theme } = this.modules;
    const extensions = [
      this.config.lineNumbers ? view.lineNumbers() : [], view.highlightActiveLine(), view.highlightActiveLineGutter(), language.bracketMatching(), autocomplete.closeBrackets(), language.indentOnInput(), autocomplete.autocompletion(), commands.history(),
      view.keymap.of([commands.indentWithTab, ...commands.defaultKeymap, ...commands.historyKeymap, ...search.searchKeymap, ...autocomplete.completionKeymap]), search.highlightSelectionMatches(), this.config.wordWrap ? view.EditorView.lineWrapping : [], languageExtension(this.modules, this.config.mode), this.config.theme === 'dark' ? theme.oneDark : []
    ];
    this.view.dispatch({ effects: state.StateEffect.reconfigure.of(extensions) });
    this.applyVisualConfig();
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (this.view) this.reconfigure(); else this.applyVisualConfig();
  }

  applyVisualConfig() {
    this.container.style.setProperty('--code-size', `${this.config.fontSize}px`);
    this.container.closest('.editor-host')?.classList.toggle('word-wrap-on', this.config.wordWrap);
    this.container.closest('.editor-host')?.classList.toggle('word-wrap-off', !this.config.wordWrap);
    document.body.classList.toggle('editor-no-lines', !this.config.lineNumbers);
    document.body.classList.toggle('editor-no-wrap', !this.config.wordWrap);
    if (this.textarea) {
      this.textarea.style.fontSize = `${this.config.fontSize}px`;
      this.textarea.style.whiteSpace = this.config.wordWrap ? 'pre-wrap' : 'pre';
    }
  }

  focus() { this.view?.focus(); this.textarea?.focus(); }
}
