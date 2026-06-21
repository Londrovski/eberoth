<template>
  <div class="note-tree">
    <header class="tree-head">
      <span class="title">Notes</span>
      <span class="status" :class="{ saving: notes.saving }">
        <template v-if="!authed">Sign in</template>
        <template v-else-if="isViewingAs">{{ viewingAsLabel }}'s notes</template>
        <template v-else-if="notes.saving">Saving…</template>
        <template v-else-if="notes.lastSavedAt">Saved</template>
      </span>
      <span class="tools">
        <button class="ico" title="New note" :disabled="!authed" @click="notes.createNote(null)"><q-icon name="note_add" size="1.5em" /></button>
        <button class="ico" title="New folder" :disabled="!authed" @click="notes.createFolder(null)"><q-icon name="create_new_folder" size="1.5em" /></button>
      </span>
    </header>

    <div class="tree-scroll" @dragover.prevent @drop="dropToRoot">
      <div
        v-for="row in visible"
        :key="row.node.id"
        class="row"
        :class="{ active: isActiveNote(row.node), folder: row.node.type==='folder', dragover: dropId===row.node.id }"
        :style="{ paddingLeft: (10 + row.depth * 16) + 'px' }"
        :draggable="authed && editingId !== row.node.id"
        @click="onRowClick(row.node)"
        @dragstart="onDragStart(row.node, $event)"
        @dragover.prevent="dropId = row.node.id"
        @dragleave="dropId === row.node.id && (dropId = null)"
        @drop.stop="onDrop(row.node)"
        @dragend="onDragEnd"
      >
        <span v-if="row.node.type==='folder'" class="twisty">
          <q-icon :name="row.node.collapsed ? 'chevron_right' : 'expand_more'" size="1.5em" />
        </span>
        <span v-else class="twisty narrow"></span>

        <q-icon :name="row.node.type==='folder' ? (row.node.collapsed ? 'folder' : 'folder_open') : 'description'" size="1.3em" class="kind-ico" />

        <input
          v-if="editingId === row.node.id"
          ref="renameInput"
          v-model="draft"
          class="rename"
          @click.stop
          @keydown.enter.prevent="commitRename(row.node)"
          @keydown.escape.prevent="cancelRename"
          @blur="commitRename(row.node)"
        />
        <span v-else class="label" @dblclick.stop="startRename(row.node)">{{ row.node.label }}</span>

        <!-- inline delete confirm (persists regardless of hover) -->
        <span v-if="confirmId === row.node.id" class="confirm" @click.stop>
          <span class="confirm-q">Delete?</span>
          <button class="ico sm ok" title="Confirm delete" @click="doDelete(row.node)"><q-icon name="check" size="1.2em" /></button>
          <button class="ico sm" title="Cancel" @click="confirmId = null"><q-icon name="close" size="1.2em" /></button>
        </span>
        <span v-else class="row-tools" @click.stop>
          <button v-if="row.node.type==='folder'" class="ico sm" title="Add note in folder" @click="notes.createNote(row.node.id)"><q-icon name="note_add" size="1.2em" /></button>
          <button v-if="row.node.type==='folder'" class="ico sm" title="Add subfolder" @click="notes.createFolder(row.node.id)"><q-icon name="create_new_folder" size="1.2em" /></button>
          <button class="ico sm" title="Rename" @click="startRename(row.node)"><q-icon name="edit" size="1.2em" /></button>
          <button class="ico sm danger" title="Delete" @click="confirmId = row.node.id"><q-icon name="delete" size="1.2em" /></button>
        </span>
      </div>

      <div v-if="!visible.length" class="empty">No notes yet. Use the buttons above to make a folder or a note.</div>

      <!-- Campaign History — read-only session docs, open in the main pane -->
      <div v-if="notes.sessions.length" class="canon">
        <div class="canon-head">Campaign History</div>
        <div
          v-for="s in sortedSessions"
          :key="s.id"
          class="canon-row"
          :class="{ active: isActiveSession(s) }"
          @click="notes.setActiveSession(s.id)"
        >
          <q-icon name="auto_stories" size="1.2em" class="kind-ico" />
          <span class="label">{{ sessionLabel(s) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useNotesStore } from 'src/stores/notes';
import { useAuthStore } from 'src/stores/auth';
import { childrenOf } from 'src/api/notepad';

const notes = useNotesStore();
const auth = useAuthStore();

const authed = computed(() => !!auth.user);
const isViewingAs = computed(() => auth.isViewingAs);
const viewingAsLabel = computed(() => {
  const b = auth.viewingAs;
  return b ? b.charAt(0).toUpperCase() + b.slice(1) : '';
});

function sessionLabel(s) {
  return 'Session ' + s.number + (s.title ? ' - ' + s.title : '');
}
const sortedSessions = computed(() =>
  [...notes.sessions].sort((a, b) => (a.number || 0) - (b.number || 0))
);

function isActiveNote(node) {
  return notes.activeKind === 'note' && node.id === notes.activeId;
}
function isActiveSession(s) {
  return notes.activeKind === 'session' && String(s.id) === String(notes.activeSessionId);
}

// Flatten the tree into an ordered, depth-tagged visible list.
const visible = computed(() => {
  const out = [];
  const walk = (parentId, depth) => {
    childrenOf(notes.nodes, parentId).forEach((node) => {
      out.push({ node, depth });
      if (node.type === 'folder' && !node.collapsed) walk(node.id, depth + 1);
    });
  };
  walk(null, 0);
  return out;
});

function onRowClick(node) {
  if (editingId.value === node.id) return;
  notes.setActive(node.id);
}

// ── rename ──
const editingId = ref(null);
const draft = ref('');
const renameInput = ref(null);
async function startRename(node) {
  confirmId.value = null;
  editingId.value = node.id;
  draft.value = node.label;
  await nextTick();
  const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value;
  if (el) { el.focus(); el.select(); }
}
function commitRename(node) {
  if (editingId.value !== node.id) return;
  notes.rename(node.id, draft.value);
  editingId.value = null;
}
function cancelRename() { editingId.value = null; }

// ── delete (inline confirm) ──
const confirmId = ref(null);
function doDelete(node) { notes.remove(node.id); confirmId.value = null; }

// ── drag & drop ──
const dragId = ref(null);
const dropId = ref(null);
function onDragStart(node, e) {
  dragId.value = node.id;
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', node.id); }
}
function onDrop(target) {
  dropId.value = null;
  const id = dragId.value;
  if (!id || id === target.id) return;
  if (target.type === 'folder') notes.move(id, target.id);
  else notes.move(id, target.parentId, target.id);
  dragId.value = null;
}
function dropToRoot() {
  const id = dragId.value;
  if (id) notes.move(id, null);
  dragId.value = null; dropId.value = null;
}
function onDragEnd() { dragId.value = null; dropId.value = null; }
</script>

<style scoped>
.note-tree { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-panel); font-size: calc(15px * var(--nz, 1)); }
.tree-head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 12px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.tree-head .title {
  font-size: 0.95em; letter-spacing: var(--section-heading-spacing);
  text-transform: uppercase; color: var(--section-heading-color); font-weight: bold;
}
.tree-head .status { font-size: 0.75em; color: var(--text-dim); }
.tree-head .status.saving { color: var(--gold-dim); }
.tree-head .tools { margin-left: auto; display: flex; gap: 4px; }

.ico {
  background: transparent; border: none; color: var(--text-dim);
  cursor: pointer; padding: 4px; border-radius: 4px; display: inline-flex; align-items: center;
}
.ico:hover { color: var(--gold-bright); background: rgba(201,169,97,0.12); }
.ico:disabled { opacity: 0.35; cursor: default; }
.ico.sm { padding: 3px; }
.ico.danger:hover { color: var(--red); background: rgba(139,58,58,0.18); }
.ico.ok:hover { color: #9ec7a0; background: rgba(120,180,120,0.18); }

.tree-scroll { flex: 1; overflow-y: auto; padding: 6px 0 28px; min-height: 0; }

.row {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 8px 7px 0; cursor: pointer; font-size: 1em; color: var(--text);
  border-left: 2px solid transparent; user-select: none;
}
.row:hover { background: var(--bg-panel-2); }
.row.active { background: rgba(201,169,97,0.16); border-left-color: var(--gold); color: var(--gold-bright); }
.row.dragover { background: rgba(201,169,97,0.24); box-shadow: inset 0 -2px 0 var(--gold-dim); }
.twisty { display: inline-flex; width: 22px; color: var(--text-dim); flex-shrink: 0; }
.twisty.narrow { width: 12px; }
.kind-ico { color: var(--gold-dim); flex-shrink: 0; }
.label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rename {
  flex: 1; background: var(--bg); color: var(--gold-bright);
  border: 1px solid var(--gold-dim); border-radius: 3px; padding: 2px 6px; font: inherit; font-size: 1em; outline: none;
}
.row-tools { display: inline-flex; gap: 2px; flex-shrink: 0; padding-right: 6px; opacity: 0.45; transition: opacity 0.12s ease; }
.row:hover .row-tools, .row.active .row-tools { opacity: 1; }
.confirm { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; padding-right: 6px; }
.confirm-q { font-size: 0.8em; color: var(--text-dim); }

.empty { padding: 18px 16px; color: var(--text-dim); font-size: 0.85em; font-style: italic; line-height: 1.55; }

.canon { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 8px; }
.canon-head {
  padding: 6px 14px 6px; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--gold-dim); font-weight: bold; font-size: 0.75em;
}
.canon-row {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 10px 7px 16px; cursor: pointer; font-size: 1em; color: var(--text-dim);
  border-left: 2px solid transparent;
}
.canon-row:hover { background: var(--bg-panel-2); color: var(--gold-bright); }
.canon-row.active { background: rgba(201,169,97,0.16); border-left-color: var(--gold); color: var(--gold-bright); }
</style>
