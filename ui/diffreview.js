// רכיב סקירת שינויים: diff ברמת מילה עם קבלה/דחייה לכל שינוי
import { diffWordsWithSpace } from '../node_modules/diff/libesm/index.js';
import { h } from './lib.js';

export function diffReview(original, revised, { findings = [], onChange } = {}) {
  const parts = diffWordsWithSpace(original, revised);
  // קיבוץ שינויים צמודים להאנקים (del+ins)
  const items = [];
  let i = 0, hid = 0;
  while (i < parts.length) {
    const p = parts[i];
    if (!p.added && !p.removed) { items.push({ t: 'eq', v: p.value }); i++; continue; }
    const hk = { t: 'h', id: hid++, del: '', ins: '', on: true };
    while (i < parts.length && (parts[i].added || parts[i].removed)) { if (parts[i].removed) hk.del += parts[i].value; else hk.ins += parts[i].value; i++; }
    items.push(hk);
  }
  const hunks = items.filter((x) => x.t === 'h');
  const box = h('div', { class: 'diffbox', dir: 'rtl' });
  const result = () => items.map((x) => (x.t === 'eq' ? x.v : x.on ? x.ins : x.del)).join('');
  const draw = () => {
    box.innerHTML = '';
    items.forEach((x) => {
      if (x.t === 'eq') box.append(document.createTextNode(x.v));
      else {
        const wrap = h('span', { class: x.on ? '' : 'rej', 'data-h': x.id, onclick: () => { x.on = !x.on; draw(); onChange && onChange(stats()); } });
        if (x.del) wrap.append(h('del', { title: 'לחצו כדי להחזיר את המקור' }, x.del));
        if (x.ins) wrap.append(h('ins', { title: 'לחצו כדי לבטל את השינוי' }, x.ins));
        box.append(wrap);
      }
    });
  };
  const stats = () => ({ total: hunks.length, accepted: hunks.filter((x) => x.on).length });
  draw();
  const jump = (quote) => {
    if (!quote) return;
    const q = quote.slice(0, 24);
    for (const el of box.querySelectorAll('span[data-h]')) if (el.textContent.includes(q)) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 1800); return; }
  };
  return { el: box, result, stats, jump, setAll: (v) => { hunks.forEach((x) => (x.on = v)); draw(); onChange && onChange(stats()); } };
}
