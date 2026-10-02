/*
 * Drag a floating card anywhere inside its container.
 *
 * The whole card is the handle. A press only becomes a drag after a few
 * pixels of movement, so the buttons inside (legend chips) still click, and
 * the click that ends a drag is swallowed. Double-click the card to put it
 * back where the stylesheet placed it. The position is a personal layout
 * choice, so it lives in localStorage and not in the shareable URL hash.
 */

const THRESHOLD = 4;

export function makeDraggable(card, { container, storageKey, enabled = () => true }) {
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; } },
    set(v) { try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* private mode */ } },
    clear() { try { localStorage.removeItem(storageKey); } catch { /* private mode */ } }
  };

  const clamp = (x, y) => {
    const c = container.getBoundingClientRect();
    return [
      Math.min(Math.max(0, x), Math.max(0, c.width - card.offsetWidth)),
      Math.min(Math.max(0, y), Math.max(0, c.height - card.offsetHeight))
    ];
  };

  const place = (x, y) => {
    [x, y] = clamp(x, y);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.right = 'auto';
    card.style.bottom = 'auto';
    return [x, y];
  };

  const reset = () => {
    for (const p of ['left', 'top', 'right', 'bottom']) card.style.removeProperty(p);
    card.classList.remove('dragged');
  };

  const restore = () => {
    const saved = store.get();
    if (!enabled() || !saved) { reset(); return; }
    card.classList.add('dragged');
    place(saved[0], saved[1]);
  };

  let start = null;       // { px, py, ox, oy, id }
  let dragging = false;
  let swallowClick = false;

  /* Move and release are tracked on window, not on the card: a quick flick
     leaves the card before the first move event, and capturing the pointer
     on press would retarget the click away from the legend chips. */
  const move = ev => {
    if (!start || ev.pointerId !== start.id) return;
    const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
    if (!dragging) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      dragging = true;
      card.classList.add('dragged', 'dragging');
    }
    place(start.ox + dx, start.oy + dy);
  };

  const end = ev => {
    if (!start || ev.pointerId !== start.id) return;
    if (dragging) {
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 0);
      store.set([parseFloat(card.style.left), parseFloat(card.style.top)]);
    }
    card.classList.remove('dragging');
    start = null;
    dragging = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };

  card.addEventListener('pointerdown', ev => {
    if (!enabled() || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const c = container.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    start = { px: ev.clientX, py: ev.clientY, ox: r.left - c.left, oy: r.top - c.top, id: ev.pointerId };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });

  card.addEventListener('click', ev => {
    if (swallowClick) { ev.stopPropagation(); ev.preventDefault(); }
  }, true);

  card.addEventListener('dblclick', ev => {
    if (!enabled()) return;
    ev.preventDefault();
    store.clear();
    reset();
  });

  /* Keep the card on screen when the stage shrinks or the layout switches. */
  const refit = () => {
    if (!enabled()) { reset(); return; }
    if (card.classList.contains('dragged')) place(parseFloat(card.style.left), parseFloat(card.style.top));
    else restore();
  };
  if ('ResizeObserver' in window) new ResizeObserver(refit).observe(container);
  window.addEventListener('resize', refit);

  restore();
}
