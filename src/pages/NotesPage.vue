<template>
  <q-page class="notes-page" :style="{ '--nz': userZoom }">
    <div class="notes-layout">
      <aside class="tree-pane" :style="{ width: Math.round(drawerWidth * userZoom) + 'px' }">
        <NoteTree />
      </aside>

      <div class="resizer" :class="{ dragging }" @mousedown="onDragStart" @dblclick="resetWidth"
           title="Drag to resize · double-click to reset">
        <div class="resizer-grip"><span></span><span></span><span></span></div>
      </div>

      <main class="editor-pane">
        <div v-if="headTitle" class="note-head">
          <span class="doc-title">{{ headTitle }}</span>
          <span v-if="notes.activeKind === 'session'" class="ro-tag">Read only</span>
        </div>

        <RichNoteEditor
          v-if="notes.activeKind === 'note' && activeNote"
          :key="activeNote.id"
          :node="activeNote"
          :editable="authed"
          :sessions="notes.sessions"
          @change="onChange"
        />
        <SessionReadView
          v-else-if="notes.activeKind === 'session' && activeSession"
          :key="'s-' + activeSession.id"
          :session="activeSession"
        />
        <div v-else class="placeholder">
          <q-icon name="description" size="44px" />
          <p v-if="!authed">Sign in to write notes.</p>
          <p v-else>Select a note on the left, or create one with the + buttons.</p>
        </div>
      </main>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import NoteTree from 'components/notes/NoteTree.vue';
import RichNoteEditor from 'components/notes/editor/RichNoteEditor.vue';
import SessionReadView from 'components/notes/SessionReadView.vue';
import { useNotesStore } from 'src/stores/notes';
import { useAuthStore } from 'src/stores/auth';
import { useUserPrefsStore } from 'src/stores/user-prefs';
import { sessionLabel } from 'src/utils/sessionLabel';

const notes = useNotesStore();
const auth = useAuthStore();
const prefs = useUserPrefsStore();

const authed = computed(() => !!auth.user);
const activeNote = computed(() => notes.activeNode);
const activeSession = computed(() => notes.activeSession);
const userZoom = computed(() => prefs.userZoom || 1);

const headTitle = computed(() => {
  if (notes.activeKind === 'note' && activeNote.value) return activeNote.value.label;
  if (notes.activeKind === 'session' && activeSession.value) return sessionLabel(activeSession.value);
  return '';
});

function onChange(html) {
  if (activeNote.value) notes.setNoteHtml(activeNote.value.id, html);
}

// ── resizer (reuses the user-prefs drawer width) ──
const DEFAULT_WIDTH = 340;
const MIN = 240;
const ABS_MAX = 680;
const dragging = ref(false);
function dynamicMax() {
  if (typeof window === 'undefined') return ABS_MAX;
  return Math.min(ABS_MAX, Math.floor(window.innerWidth * 0.5));
}
function clamp(v) { return Math.max(MIN, Math.min(dynamicMax(), v)); }
const drawerWidth = computed(() => clamp(prefs.notesDrawerWidth || DEFAULT_WIDTH));
let startX = 0; let startW = 0;
function onDragStart(e) {
  dragging.value = true; startX = e.clientX; startW = drawerWidth.value;
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onDragMove); window.addEventListener('mouseup', onDragEnd);
}
function onDragMove(e) { prefs.setNotesDrawerWidth(clamp(startW + (e.clientX - startX))); }
function onDragEnd() {
  dragging.value = false; document.body.style.cursor = ''; document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd);
}
function resetWidth() { prefs.setNotesDrawerWidth(DEFAULT_WIDTH); }

watch(() => auth.viewingAs, () => { notes.load(); });
watch(() => auth.user && auth.user.email, () => { notes.load(); });

onMounted(() => { prefs.load(); notes.load(); });
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  notes.flush();
});
</script>

<style scoped>
.notes-page { height: calc(100vh - 64px); padding: 0; background: var(--bg); }
.notes-layout { display: flex; height: 100%; width: 100%; }

.tree-pane { flex-shrink: 0; min-height: 0; border-right: 1px solid var(--border); }

.resizer {
  flex: 0 0 8px; cursor: col-resize; background: var(--bg-panel-2);
  border-left: 1px solid var(--gold-dim); border-right: 1px solid var(--gold-dim);
  position: relative; z-index: 1;
}
.resizer:hover, .resizer.dragging { background: rgba(201,169,97,0.18); border-color: var(--gold); }
.resizer-grip { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); display: flex; flex-direction: column; gap: 4px; pointer-events: none; }
.resizer-grip span { width: 4px; height: 4px; border-radius: 50%; background: var(--gold-dim); }
.resizer:hover .resizer-grip span, .resizer.dragging .resizer-grip span { background: var(--gold); }

.editor-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-panel); }
.note-head {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 22px; border-bottom: 1px solid var(--border); background: var(--bg-panel-2); flex-shrink: 0;
}
.doc-title { font-size: calc(18px * var(--nz, 1)); color: var(--gold-bright); font-weight: 600; letter-spacing: 0.01em; }
.ro-tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; }
.placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-dim); font-style: italic; text-align: center; padding: 24px; font-size: 15px;
}

@media (max-width: 700px) {
  .notes-page { height: auto; min-height: 100vh; }
  .notes-layout { flex-direction: column; }
  .tree-pane { width: 100% !important; max-height: 42vh; border-right: none; border-bottom: 2px solid var(--gold-dim); }
  .resizer { display: none; }
  .editor-pane { min-height: 58vh; }
}
</style>

<style>
/* ── Notes: global editor surface styles (unscoped on purpose) ───────── */
.ProseMirror {
  outline: none;
  padding: 20px 26px 70px;
  color: var(--text);
  font-size: calc(16.5px * var(--nz, 1));
  line-height: 1.7;
  min-height: 100%;
}
.ProseMirror:focus { outline: none; }
.ProseMirror > * + * { margin-top: 0.7em; }
.ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { color: var(--gold-bright); font-weight: 600; line-height: 1.25; }
.ProseMirror h1 { font-size: 1.5em; }
.ProseMirror h2 { font-size: 1.28em; }
.ProseMirror h3 { font-size: 1.12em; }
.ProseMirror ul, .ProseMirror ol { padding-left: 1.4em; }
.ProseMirror ul { list-style: disc; }
.ProseMirror ol { list-style: decimal; }
.ProseMirror li { margin: 0.2em 0; }
.ProseMirror blockquote { border-left: 3px solid var(--gold-dim); padding-left: 12px; color: var(--text-dim); font-style: italic; }
.ProseMirror hr { border: none; border-top: 1px solid var(--border); margin: 1em 0; }
.ProseMirror code { background: var(--bg-panel-2); padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
.ProseMirror mark { border-radius: 2px; padding: 0 2px; color: #1c180f; }

/* Checklists */
.ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.2em; }
.ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 9px; }
.ProseMirror ul[data-type="taskList"] li > label { margin-top: 3px; }
.ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
.ProseMirror ul[data-type="taskList"] input[type="checkbox"] { accent-color: var(--gold); width: 17px; height: 17px; cursor: pointer; }

/* Placeholder */
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--text-dim); font-style: italic; float: left; height: 0; pointer-events: none;
}

/* Mention links (editor + read-only) */
.ProseMirror a.mention, a.mention {
  color: var(--bold-accent-color); font-weight: 600;
  text-decoration: underline; text-decoration-color: var(--gold-dim);
  text-underline-offset: 2px; cursor: pointer; padding: 0 1px; border-radius: 2px;
}
.ProseMirror a.mention:hover, a.mention:hover { background: rgba(216,201,138,0.14); text-decoration-color: var(--gold); }

/* @-mention suggestion popup (appended to <body>) */
.mention-suggest {
  position: fixed; z-index: 4000;
  background: var(--bg-panel); border: 1px solid var(--gold-dim); border-radius: 4px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.55);
  min-width: 230px; max-width: 340px; padding: 4px 0;
}
.mention-suggest .ms-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 14px; color: var(--text); }
.mention-suggest .ms-row:hover, .mention-suggest .ms-row.sel { background: var(--bg-panel-2); color: var(--gold-bright); }
.mention-suggest .ms-kind { font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--gold-dim); min-width: 54px; }
.mention-suggest .ms-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
