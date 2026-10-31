// עזרי UI משותפים
export const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'disabled') el.disabled = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
};
export const call = (ch, ...a) => window.ss.call(ch, ...a);
export const on = (ch, fn) => window.ss.on(ch, fn);

export function toast(msg, type = '') {
  const t = h('div', { class: 'toast ' + type }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), type === 'err' ? 9000 : 4200);
}
export const fail = (e) => { console.error(e); toast(e.message || String(e), 'err'); };

export function modal(title, body, actions = []) {
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
  const m = h('div', { class: 'modal' }, h('h2', {}, title), body, h('div', { class: 'row', style: 'margin-top:18px;justify-content:flex-start' }, actions.map((a) => h('button', { class: 'btn ' + (a.cls || ''), onclick: async () => { const r = a.fn ? await a.fn(bg) : null; if (a.close !== false && r !== false) bg.remove(); } }, a.label))));
  bg.append(m); document.body.append(bg); return bg;
}

// הרצת פעולה אסינכרונית עם מצב עסוק על כפתור
export async function busy(btn, fn, label) {
  const old = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${label || 'עובד…'}`; }
  try { return await fn(); } catch (e) { fail(e); } finally { if (btn) { btn.disabled = false; btn.innerHTML = old; } }
}

export const fmt = (n) => Number(n || 0).toLocaleString('he-IL');
export const fileUrl = (p) => 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
export const field = (label, input, hint) => h('div', { class: 'field' }, h('label', { class: 'f' }, label), input, hint ? h('div', { class: 'small muted', style: 'margin-top:3px' }, hint) : null);
export const select = (opts, val, onChange, props = {}) => h('select', { ...props, onchange: (e) => onChange(e.target.value) }, opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; const el = h('option', { value: v }, l); if (String(v) === String(val)) el.selected = true; return el; }));
export const check = (label, val, onChange) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!val, onchange: (e) => onChange(e.target.checked) }), label);
export const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const KIND_LABEL = { chapter: 'פרק', part: 'חלק', preface: 'פתח דבר', foreword: 'הקדמה', intro: 'מבוא', dedication: 'הקדשה', epigraph: 'מוטו', afterword: 'אחרית דבר', acknowledgments: 'תודות', about: 'על המחבר/ת', notes: 'הערות', appendix: 'נספח' };
