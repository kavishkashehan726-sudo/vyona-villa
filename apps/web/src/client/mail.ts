// Email links (`a[data-mail]`, a mailto: href) open the visitor's mail app as usual. A page can't
// ask whether a mail app exists, so we watch instead: when one opens, the browser loses focus or
// the page is hidden. If neither happens soon after the click (no mail app, or the visitor turned
// down the browser's prompt), or the same link is clicked again, a small panel offers Gmail in a
// new tab or copying the address.

import { $, toast } from './ui';

const WAIT = 1500;
const AGAIN = 30_000;

let panel: HTMLElement | null = null;
let lastClick = 0;

type Mail = { to: string; subject: string };

function parse(href: string): Mail | null {
  if (!href.toLowerCase().startsWith('mailto:')) return null;
  const [addr = '', query = ''] = href.slice(7).split('?');
  const to = decodeURIComponent(addr);
  return to ? { to, subject: new URLSearchParams(query).get('subject') ?? '' } : null;
}

const gmailHref = ({ to, subject }: Mail) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;

function build() {
  const el = document.createElement('div');
  el.className = 'mail-help';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'mail-help-title');
  el.hidden = true;
  el.innerHTML = `
    <p class="mail-help__title" id="mail-help-title">No mail app opened?</p>
    <p class="mail-help__to" data-mail-to></p>
    <div class="mail-help__actions">
      <a class="btn btn--sm btn--olive" target="_blank" rel="noopener" data-mail-gmail>Write in Gmail</a>
      <button type="button" class="btn btn--sm btn--line" data-mail-copy>Copy address</button>
    </div>
    <button type="button" class="icon-btn mail-help__close" aria-label="Close" data-mail-close>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>
    </button>`;
  document.body.append(el);
  $('[data-mail-close]', el)?.addEventListener('click', () => hide(true));
  $('[data-mail-gmail]', el)?.addEventListener('click', () => hide());
  $('[data-mail-copy]', el)?.addEventListener('click', () => {
    const to = el.dataset.to ?? '';
    copy(to).then(
      () => toast(`Copied ${to}`),
      () => toast(`Our email is ${to}`),
    );
    hide(true);
  });
  return el;
}

async function copy(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const t = document.createElement('textarea');
  t.value = text;
  t.setAttribute('readonly', '');
  t.style.cssText = 'position:fixed;opacity:0';
  document.body.append(t);
  t.select();
  const ok = document.execCommand('copy');
  t.remove();
  if (!ok) throw new Error('copy failed');
}

let opener: HTMLAnchorElement | null = null;

function show(a: HTMLAnchorElement, mail: Mail) {
  panel ??= build();
  opener = a;
  panel.dataset.to = mail.to;
  $('[data-mail-to]', panel)!.textContent = mail.to;
  $<HTMLAnchorElement>('[data-mail-gmail]', panel)!.href = gmailHref(mail);
  panel.hidden = false;
  place();
  requestAnimationFrame(() => panel?.classList.add('is-on'));
  $<HTMLElement>('[data-mail-gmail]', panel)?.focus({ preventScroll: true });
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', place);
}

function hide(refocus = false) {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  panel.classList.remove('is-on');
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('resize', place);
  if (refocus) opener?.focus({ preventScroll: true });
}

// Just under the link, kept inside the viewport's width; it scrolls with the page.
function place() {
  if (!panel || !opener) return;
  const r = opener.getBoundingClientRect();
  const w = panel.offsetWidth;
  const left = Math.max(16, Math.min(r.left, document.documentElement.clientWidth - w - 16));
  panel.style.left = `${left + scrollX}px`;
  panel.style.top = `${r.bottom + scrollY + 10}px`;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') hide(true);
}

function onOutside(e: PointerEvent) {
  const t = e.target as Node;
  if (panel?.contains(t) || opener?.contains(t)) return;
  hide();
}

function onClick(e: MouseEvent) {
  const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-mail]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const mail = parse(a.getAttribute('href') ?? '');
  if (!mail) return;

  const now = Date.now();
  const again = now - lastClick < AGAIN;
  lastClick = now;
  if (again) {
    show(a, mail);
    return;
  }

  hide();
  let left = false;
  const gone = () => (left = true);
  const onVisible = () => document.hidden && gone();
  window.addEventListener('blur', gone);
  window.addEventListener('pagehide', gone);
  document.addEventListener('visibilitychange', onVisible);
  window.setTimeout(() => {
    window.removeEventListener('blur', gone);
    window.removeEventListener('pagehide', gone);
    document.removeEventListener('visibilitychange', onVisible);
    if (!left && !document.hidden && document.hasFocus()) show(a, mail);
  }, WAIT);
}

let started = false;
export function initMail() {
  if (started) return;
  started = true;
  document.addEventListener('click', onClick);
}
