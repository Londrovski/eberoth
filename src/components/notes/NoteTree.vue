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
        <button class="ico" title="New note" :disabled="!authed" @click="notes.createNote(null)"><q-icon name="note_add" size="18px" /></button>
        <button class="ico" title="New folder" :disabled="!authed" @click="notes.createFolder(null)"><q-icon name="create_new_folder" size="18px" /></button>
      </span>
    </header>

    <div class="tree-scroll" @dragover.prevent @drop="dropToRoot">
      <div
        v-for="row in visible"
        :key="row.node.id"
        class="row"
        :class="{ active: row.node.id === notes.activeId, folder: row.node.type==='folder', dragover: dropId===row.node.id }"
        :style="{ paddingLeft: (8 + row.depth * 14) + 'px' }"
        :draggable="authed && editingId !== row.node.id"
        @click="onRowClick(row.node)"
        @dragstart="onDragStart(row.node, $event)"
        @dragover.prevent="dropId = row.node.id"
        @dragleave="dropId === row.node.id && (dropId = null)"
        @drop.stop="onDrop(row.node)"
        @dragend="onDragEnd"
      >
        <span v-if="row.node.type==='folder'" class="twisty">
          <q-icon :name="row.node.collapsed ? 'chevron_right' : 'expand_more'" size="18px" />
        </span>
        <span v-else class="twisty narrow"></span>

        <q-icon :name="row.node.type==='folder' ? (row.node.collapsed ? 'folder' : 'folder_open') : 'description'" size="16px" class="kind-ico" />

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

        <span class="row-tools" @click.stop>
          <button v-if="row.node.type==='folder'" class="ico sm" title="New note here" @click="notes.createNote(row.node.id)"><q-icon name="note_add" size="14px" /></button>
          <button v-if="row.node.type==='folder'" class="ico sm" title="New subfolder" @click="notes.createFolder(row.node.id)"><q-icon name="create_new_folder" size="14px" /></button>
          <button class="ico sm" title="Rename" @click="startRename(row.node)"><q-icon name="edit" size="14px" /></button>
          <button class="ico sm danger" title="Delete" @click="confirmDelete(row.node)"><q-icon name="delete" size="14px" /></button>
        </span>
      </div>

      <div v-if="!visible.length" class="empty">No notes yet. Use the buttons above to make a folder or a note.</div>

      <!-- Campaign History — read-only session docs -->
      <div v-if="notes.sessions.length" class="canon">
        <div class="canon-head">Campaign History</div>
        <div
          v-for="s in sortedSessions"
          :key="s.id"
          class="canon-row"
          @click="openSession(s)"
        >
          <q-icon name="auto_stories" size="15px" class="kind-ico" />
          <span class="label">{{ s.title || ('Session ' + s.number) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useNotesStore } from 'src/stores/notes';
import { useAuthStore } from 'src/stores/auth';
import { useSessionDetail } from 'src/composables/useSessionDetail';
import { childrenOf } from 'src/api/notepad';

const notes = useNotesStore();
const auth = useAuthStore();
const sessionDetail = useSessionDetail();

const authed = computed(() => !!auth.user);
const isViewingAs = computed(() => auth.isViewingAs);
const viewingAsLabel = computed(() => {
  const b = auth.viewingAs;
  return b ? b.charAt(0).toUpperCase() + b.slice(1) : '';
});

const sortedSessions = computed(() =>
  [...notes.sessions].sort((a, b) => (a.number || 0) - (b.number || 0))
);

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

function confirmDelete(node) {
  const kids = node.type === 'folder' ? ' and everything inside it' : '';
  if (window.confirm('Delete "' + node.label + '"' + kids + '?')) notes.remove(node.id);
}

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

function openSession(s) { sessionDetail.open(s, 'tree'); }
</script>

<style scoped>
.note-tree { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--bg-panel); }
.tree-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 10px 8px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.tree-head .title {
  font-size: var(--section-heading-size); letter-spacing: var(--section-heading-spacing);
  text-transform: uppercase; color: var(--section-heading-color); font-weight: bold;
}
.tree-head .status { font-size: 10px; color: var(--text-dim); }
.tree-head .status.saving { color: var(--gold-dim); }
.tree-head .tools { margin-left: auto; display: flex; gap: 2px; }

.ico {
  background: transparent; border: none; color: var(--text-dim);
  cursor: pointer; padding: 3px; border-radius: 4px; display: inline-flex; align-items: center;
}
.ico:hover { color: var(--gold-bright); background: rgba(201,169,97,0.12); }
.ico:disabled { opacity: 0.35; cursor: default; }
.ico.sm { padding: 2px; }
.ico.danger:hover { color: var(--red); background: rgba(139,58,58,0.18); }

.tree-scroll { flex: 1; overflow-y: auto; padding: 4px 0 24px; min-height: 0; }

.row {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px 4px 0; cursor: pointer; font-size: 13px; color: var(--text);
  border-left: 2px solid transparent; user-select: none;
}
.row:hover { background: var(--bg-panel-2); }
.row.active { background: rgba(201,169,97,0.14); border-left-color: var(--gold); color: var(--gold-bright); }
.row.dragover { background: rgba(201,169,97,0.22); box-shadow: inset 0 -2px 0 var(--gold-dim); }
.twisty { display: inline-flex; width: 18px; color: var(--text-dim); flex-shrink: 0; }
.twisty.narrow { width: 10px; }
.kind-ico { color: var(--gold-dim); flex-shrink: 0; }
.label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rename {
  flex: 1; background: var(--bg); color: var(--gold-bright);
  border: 1px solid var(--gold-dim); border-radius: 3px; padding: 1px 4px; font: inherit; outline: none;
}
.row-tools { display: none; gap: 1px; flex-shrink: 0; }
.row:hover .row-tools { display: inline-flex; }

.empty { padding: 16px 14px; color: var(--text-dim); font-size: 12px; font-style: italic; line-height: 1.5; }

.canon { margin-top: 10px; border-top: 1px solid var(--border); padding-top: 6px; }
.canon-head {
  padding: 6px 12px 4px; font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--gold-dim); font-weight: bold;
}
.canon-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 14px; cursor: pointer; font-size: 13px; color: var(--text-dim);
}
.canon-row:hover { background: var(--bg-panel-2); color: var(--gold-bright); }
</style>
