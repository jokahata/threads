(function () {
  const SETTINGS_KEY = 'threads-remote';
  const URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  let settings = readSettings();

  async function call(body, override) {
    const s = override || settings;
    if (!s.url || !s.key) {
      if (!override) openSettings();
      throw new Error('not configured');
    }
    const res = await fetch(s.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ key: s.key }, body)),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('The connector did not return data. Check the URL ends in /exec and access is set to Anyone.');
    }
    if (data.error) {
      const msg = data.error === 'unauthorized' ? 'The key does not match API_KEY in Api.gs.' : data.error;
      if (!override && (data.error === 'unauthorized' || /API_KEY/.test(data.error))) openSettings(msg);
      throw new Error(msg);
    }
    return data;
  }

  window.ThreadsRemoteApi = {
    load: () => call({ op: 'load' }),
    apply: (ops) => call({ op: 'apply', ops }).then(() => true),
  };

  const style = document.createElement('style');
  style.textContent = [
    '.setup { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 16px; }',
    '.setup-card { background: var(--panel); color: var(--text); border-radius: 12px; padding: 20px; width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.25); }',
    '.setup-card h2 { margin: 0; font-size: 17px; }',
    '.setup-card p { margin: 0; color: var(--muted); font-size: 13px; }',
    '.setup-card label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--muted); }',
    '.setup-card input { font-size: 16px; padding: 8px 10px; }',
    '.setup-err { color: var(--blocked); font-size: 13px; min-height: 1em; }',
    '.setup-actions { display: flex; justify-content: flex-end; gap: 8px; }',
    '#syncSettings { border: 0; background: none; color: var(--accent); padding: 4px; }',
  ].join('\n');
  document.head.appendChild(style);

  function openSettings(message) {
    if (document.getElementById('setup')) {
      if (message) document.querySelector('#setup .setup-err').textContent = message;
      return;
    }
    const wrap = document.createElement('div');
    wrap.id = 'setup';
    wrap.className = 'setup';
    wrap.innerHTML = '<form class="setup-card">'
      + '<h2>Connect to your Sheet</h2>'
      + '<p>Paste the Web app URL and key from your Threads API script. They are stored only on this device.</p>'
      + '<label>Connector URL<input name="url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off" autocapitalize="off" spellcheck="false"></label>'
      + '<label>Key<input name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label>'
      + '<div class="setup-err"></div>'
      + '<div class="setup-actions"><button type="button" data-close>Cancel</button><button type="submit" class="primary">Connect</button></div>'
      + '</form>';
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form');
    const err = wrap.querySelector('.setup-err');
    form.url.value = settings.url || '';
    form.key.value = settings.key || '';
    if (message) err.textContent = message;
    wrap.querySelector('[data-close]').addEventListener('click', () => wrap.remove());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = { url: form.url.value.trim(), key: form.key.value.trim() };
      if (!URL_RE.test(next.url)) {
        err.textContent = 'The URL should look like https://script.google.com/macros/s/.../exec';
        return;
      }
      if (!next.key) {
        err.textContent = 'Paste the key from Api.gs.';
        return;
      }
      err.textContent = 'Connecting...';
      try {
        await call({ op: 'load' }, next);
      } catch (ex) {
        err.textContent = ex.message === 'Failed to fetch' ? 'Could not reach the connector. Check the URL and your connection.' : ex.message;
        return;
      }
      settings = next;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      wrap.remove();
      window.dispatchEvent(new Event('online'));
    }, true);
    setTimeout(() => (settings.url ? form.key : form.url).focus(), 50);
  }

  const btn = document.createElement('button');
  btn.id = 'syncSettings';
  btn.type = 'button';
  btn.textContent = 'Connection';
  btn.addEventListener('click', () => openSettings());
  const sync = document.getElementById('sync');
  if (sync) sync.parentNode.insertBefore(btn, sync);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.error(e));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  window.ThreadsOpenSettings = openSettings;
})();
