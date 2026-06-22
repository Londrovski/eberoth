// useMentionPicker — wraps any contenteditable element with @-mention
// autocomplete + hyperlink click handling.
//
// Mention storage shape (inline HTML):
//   <a class="mention" data-mention-kind="entity"  data-mention-id="<uuid>">Name</a>
//   <a class="mention" data-mention-kind="session" data-mention-id="<id>">Session N</a>
//
// NOTE: the displayed text deliberately does NOT include the "@" prefix.
// The "@" is purely a trigger character while typing; once committed,
// the mention reads as a clean hyperlinked name with an underline
// affordance via CSS.
//
// Returns:
//   bind(el)            attach listeners to a contenteditable element
//   query, position     reactive picker state
//   results             reactive matching list
//   navigate(dir)       move selection up/down
//   commit()            insert the currently-selected mention
//   cancel()            close picker without inserting
//   selectedIndex
//   isOpen
//
// Designed so a single component (MentionPicker.vue) renders the floating
// list, sees `useMentionPicker()` state, and the editor wires it via
// keydown handlers. Sessions are loaded lazily and cached.

import { ref, computed, onScopeDispose } from 'vue';
import { useEntitiesStore } from 'src/stores/entities';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useSessionDetail } from 'src/composables/useSessionDetail';
import { sessionLabel } from 'src/utils/sessionLabel';
import * as sessionsApi from 'src/api/sessions';

let sessionsCache = null;
let sessionsPromise = null;

async function getSessions() {
  if (sessionsCache) return sessionsCache;
  if (!sessionsPromise) {
    sessionsPromise = sessionsApi.fetchAll().then(rows => {
      sessionsCache = rows || [];
      return sessionsCache;
    }).catch(() => { sessionsCache = []; return sessionsCache; });
  }
  return sessionsPromise;
}

export function useMentionPicker({ onInput } = {}) {
  const entities = useEntitiesStore();
  const detail = useEntityDetail();
  const sessions = useSessionDetail();

  const isOpen = ref(false);
  const query = ref('');
  const selectedIndex = ref(0);
  const caretRect = ref(null);
  const sessionRows = ref([]);

  // The element + range where the @ trigger lives. Used at commit time
  // to know what text range to replace.
  let activeEl = null;
  let triggerRange = null;  // Range from just-before '@' to caret
  let activeAtNode = null;
  let activeAtOffset = 0;

  const results = computed(() => {
    if (!isOpen.value) return [];
    const q = (query.value || '').trim().toLowerCase();
    const ents = entities.all
      .filter(e => {
        if (!e || !e.name) return false;
        const name = (e.short_name || e.name).toLowerCase();
        return !q || name.includes(q);
      })
      .slice(0, 8)
      .map(e => ({
        kind: 'entity',
        id: e.id,
        label: e.short_name || e.name,
        type: e.kind  // 'npc' | 'faction' | 'lore' | 'player'
      }));
    const sess = sessionRows.value
      .filter(s => {
        const label = sessionLabel(s).toLowerCase();
        return !q || label.includes(q);
      })
      .slice(0, 4)
      .map(s => ({
        kind: 'session',
        id: s.id,
        label: sessionLabel(s),
        type: 'session'
      }));
    return [...ents, ...sess];
  });

  // Anchor at the caret, flipping above it when the list would overflow the
  // bottom of the viewport so the whole popup stays visible.
  const position = computed(() => {
    const r = caretRect.value;
    if (!r) return { top: 0, left: 0 };
    const count = Math.min(results.value.length || 1, 12);
    const estH = count * 30 + 12;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 0;
    const below = r.bottom + 4;
    const flipUp = vh && (below + estH > vh) && (r.top - estH - 4 > 0);
    return { top: flipUp ? Math.max(4, r.top - estH - 4) : below, left: r.left };
  });

  function openPicker(el, at) {
    activeEl = el;
    activeAtNode = at.node;
    activeAtOffset = at.offset;
    isOpen.value = true;
    query.value = '';
    selectedIndex.value = 0;

    // Capture the caret rect so the picker can anchor (and flip) to it.
    try {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const r = sel.getRangeAt(0).cloneRange();
        caretRect.value = r.getBoundingClientRect();
      }
    } catch {}

    // Lazy-load sessions on first open.
    getSessions().then(rows => { sessionRows.value = rows; });
  }

  function closePicker() {
    isOpen.value = false;
    query.value = '';
    activeEl = null;
    activeAtNode = null;
    triggerRange = null;
  }

  function navigate(dir) {
    if (!isOpen.value) return;
    const list = results.value;
    if (!list.length) return;
    const next = (selectedIndex.value + dir + list.length) % list.length;
    selectedIndex.value = next;
  }

  function insertMention(item) {
    if (!activeEl || !activeAtNode) return;
    try {
      // Build the anchor — name only, no @ prefix.
      const a = document.createElement('a');
      a.className = 'mention';
      a.contentEditable = 'false';
      a.setAttribute('data-mention-kind', item.kind);
      a.setAttribute('data-mention-id', String(item.id));
      a.textContent = item.label;

      // Replace from the '@' character through to the current caret with
      // the anchor + a trailing space.
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const caretRange = sel.getRangeAt(0);

      const replaceRange = document.createRange();
      replaceRange.setStart(activeAtNode, activeAtOffset);
      replaceRange.setEnd(caretRange.endContainer, caretRange.endOffset);
      replaceRange.deleteContents();

      const space = document.createTextNode(' ');
      replaceRange.insertNode(space);
      replaceRange.insertNode(a);

      // Move caret after the space.
      const after = document.createRange();
      after.setStart(space, space.length);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);

      // Notify owner so they can save HTML.
      if (typeof onInput === 'function') onInput(activeEl);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[mention] insert failed', e);
    }
    closePicker();
  }

  function commit() {
    const list = results.value;
    if (!list.length) return closePicker();
    insertMention(list[selectedIndex.value]);
  }

  // ----- Editor binding -----

  function onKeydown(e) {
    if (isOpen.value) {
      if (e.key === 'ArrowDown') { e.preventDefault(); navigate(1);  return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); navigate(-1); return; }
      if (e.key === 'Enter')     { e.preventDefault(); commit();     return; }
      if (e.key === 'Tab')       { e.preventDefault(); commit();     return; }
      if (e.key === 'Escape')    { e.preventDefault(); closePicker(); return; }
    }
  }

  function onInputEvt(e) {
    const el = e.currentTarget;
    // Detect '@' at the current caret; if found, open the picker and
    // capture the trigger node + offset.
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.endContainer;
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      if (isOpen.value) closePicker();
      // Still notify the host so it can persist non-mention input.
      if (typeof onInput === 'function') onInput(el);
      return;
    }
    const text = node.textContent || '';
    const offsetBeforeCaret = range.endOffset;

    // Walk back from caret to find a recent '@' that isn't inside an
    // existing word boundary.
    let atOffset = -1;
    for (let i = offsetBeforeCaret - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '@') { atOffset = i; break; }
      // Stop on whitespace or newline so '@' only triggers when fresh.
      if (/\s/.test(ch)) break;
      // Safety break after 30 chars.
      if (offsetBeforeCaret - i > 30) break;
    }

    if (atOffset < 0) {
      if (isOpen.value) closePicker();
      if (typeof onInput === 'function') onInput(el);
      return;
    }

    // Open or update query.
    if (!isOpen.value) {
      openPicker(el, { node, offset: atOffset });
    } else {
      // Keep the anchor fresh as the caret moves while typing the query.
      try {
        const s2 = window.getSelection();
        if (s2.rangeCount) caretRect.value = s2.getRangeAt(0).cloneRange().getBoundingClientRect();
      } catch {}
    }
    query.value = text.slice(atOffset + 1, offsetBeforeCaret);
    selectedIndex.value = 0;
    if (typeof onInput === 'function') onInput(el);
  }

  function onMentionClick(e) {
    // Event delegation on the editor: any click on a .mention link
    // opens the right panel. preventDefault stops the browser following
    // the href (we don't set one but defensively).
    const a = e.target && e.target.closest && e.target.closest('a.mention');
    if (!a) return;
    e.preventDefault();
    const kind = a.getAttribute('data-mention-kind');
    const id   = a.getAttribute('data-mention-id');
    if (!kind || !id) return;
    if (kind === 'entity') {
      detail.open(id);
    } else if (kind === 'session') {
      const s = (sessionsCache || []).find(x => String(x.id) === String(id));
      if (s) sessions.open(s);
      else {
        // If sessions weren't pre-loaded for some reason, load and open.
        getSessions().then(rows => {
          const r = rows.find(x => String(x.id) === String(id));
          if (r) sessions.open(r);
        });
      }
    }
  }

  function bind(el) {
    if (!el) return;
    el.addEventListener('keydown', onKeydown);
    el.addEventListener('input', onInputEvt);
    el.addEventListener('click', onMentionClick);
  }

  function unbind(el) {
    if (!el) return;
    el.removeEventListener('keydown', onKeydown);
    el.removeEventListener('input', onInputEvt);
    el.removeEventListener('click', onMentionClick);
  }

  onScopeDispose(() => { closePicker(); });

  return {
    isOpen, query, position, results, selectedIndex,
    navigate, commit, cancel: closePicker,
    bind, unbind
  };
}
