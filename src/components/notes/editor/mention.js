// Custom TipTap mention node.
//
// Stays byte-compatible with the legacy stored format so old notes keep
// working and links remain clickable even outside the editor:
//   <a class="mention" data-mention-kind="entity|session" data-mention-id="..">Label</a>
//
// `@` opens a lightweight suggestion popup (entities + sessions). Picking
// one inserts a mention node. Clicks are handled by the editor host.
import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';

function kindLabel(t) {
  if (t === 'npc') return 'NPC';
  if (t === 'faction') return 'Faction';
  if (t === 'lore') return 'Lore';
  if (t === 'player') return 'Player';
  if (t === 'session') return 'Session';
  return '';
}

function makePopup() {
  const el = document.createElement('div');
  el.className = 'mention-suggest';
  el.style.display = 'none';
  // Sit above Quasar's dialog overlay (~6000) so the popup is never hidden
  // behind the entity/session detail panel when typing @ in its notes.
  el.style.zIndex = '7000';
  document.body.appendChild(el);
  let items = [];
  let command = null;
  let selected = 0;
  let lastRect = null;

  // Place the popup at the caret, flipping above it when it would overflow
  // the bottom of the viewport, so the whole list stays visible.
  function reposition() {
    if (!lastRect) return;
    const h = el.offsetHeight || 0;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 0;
    const below = lastRect.bottom + 4;
    const flipUp = vh && (below + h > vh) && (lastRect.top - h - 4 > 0);
    el.style.top = (flipUp ? Math.max(4, lastRect.top - h - 4) : below) + 'px';
    el.style.left = lastRect.left + 'px';
  }
  function pick(i) {
    const it = items[i];
    if (it && command) command({ id: it.id, label: it.label, kind: it.kind });
  }
  function render() {
    el.innerHTML = '';
    if (!items.length) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'ms-row' + (i === selected ? ' sel' : '');
      const k = document.createElement('span');
      k.className = 'ms-kind';
      k.textContent = kindLabel(it.type);
      const l = document.createElement('span');
      l.className = 'ms-label';
      l.textContent = it.label;
      row.appendChild(k);
      row.appendChild(l);
      row.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
      el.appendChild(row);
    });
  }
  return {
    update(props) {
      items = props.items || [];
      command = props.command;
      selected = 0;
      lastRect = (props.clientRect && props.clientRect()) || lastRect;
      render();      // build + show first, so offsetHeight is measurable
      reposition();  // then place (flips up if needed)
    },
    onKeyDown({ event }) {
      if (!items.length) return false;
      if (event.key === 'ArrowDown') { selected = (selected + 1) % items.length; render(); return true; }
      if (event.key === 'ArrowUp') { selected = (selected - 1 + items.length) % items.length; render(); return true; }
      if (event.key === 'Enter' || event.key === 'Tab') { pick(selected); return true; }
      if (event.key === 'Escape') { el.style.display = 'none'; return true; }
      return false;
    },
    destroy() { el.remove(); }
  };
}

export function buildMention({ getItems }) {
  return Mention.extend({
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-mention-id'),
          renderHTML: (attrs) => (attrs.id ? { 'data-mention-id': attrs.id } : {})
        },
        kind: {
          default: 'entity',
          parseHTML: (el) => el.getAttribute('data-mention-kind') || 'entity',
          renderHTML: (attrs) => ({ 'data-mention-kind': attrs.kind || 'entity' })
        },
        label: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-mention-label') || el.textContent,
          renderHTML: () => ({})
        }
      };
    },
    parseHTML() {
      return [{ tag: 'a.mention' }];
    },
    renderHTML({ node, HTMLAttributes }) {
      return [
        'a',
        mergeAttributes({ class: 'mention', contenteditable: 'false' }, HTMLAttributes),
        node.attrs.label || ''
      ];
    },
    renderText({ node }) {
      return node.attrs.label || '';
    }
  }).configure({
    suggestion: {
      char: '@',
      items: ({ query }) => getItems(query),
      command: ({ editor, range, props }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: 'mention', attrs: { id: props.id, label: props.label, kind: props.kind } },
            { type: 'text', text: ' ' }
          ])
          .run();
      },
      render: () => {
        let popup = null;
        return {
          onStart: (props) => { popup = makePopup(); popup.update(props); },
          onUpdate: (props) => { if (popup) popup.update(props); },
          onKeyDown: (props) => (popup ? popup.onKeyDown(props) : false),
          onExit: () => { if (popup) { popup.destroy(); popup = null; } }
        };
      }
    }
  });
}
