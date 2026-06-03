<template>
  <div class="notepad-panel">
    <header class="drawer-header">
      <span class="hdr-title">Notes</span>
      <span class="status" :class="{ saving }">
        <template v-if="!authed">Sign in</template>
        <template v-else-if="isViewingAs">{{ viewingAsLabel }}'s notes — read only</template>
        <template v-else-if="saving">Saving...</template>
        <template v-else-if="lastSavedAt">Saved {{ relativeSaved }}</template>
      </span>
    </header>

    <div class="notes-tabs">
      <button
        v-for="tab in state.tabs"
        :key="tab.id"
        class="note-tab"
        :class="{ active: tab.id === state.activeId }"
        @click="onTabClick(tab)"
      >
        <span
          class="label"
          @dblclick.stop="!isViewingAs && onRenameStart(tab, $event)"
          @blur="!isViewingAs && onRenameEnd(tab, $event)"
          @keydown.enter.prevent="$event.target.blur()"
          @keydown.escape="onRenameCancel(tab, $event)"
        >{{ tab.label }}</span>
        <span
          v-if="state.tabs.length > 1 && !isViewingAs"
          class="close"
          :title="'Close tab'"
          @click.stop="onDelete(tab)"
        >x</span>
      </button>
      <button v-if="!isViewingAs" class="add-tab" :title="'New tab'" :disabled="!authed" @click="onAdd">+</button>
    </div>

    <div class="note-body-wrap">
      <div
        class="note-body"
        :contenteditable="authed && !isViewingAs"
        spellcheck="true"
        @blur="flush"
        ref="bodyEl"
      ></div>
    </div>

    <MentionPicker :picker="picker" />
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useAuthStore } from 'src/stores/auth';
import { fetchNotepad, saveNotepad, newTab } from 'src/api/notepad';
import { useMentionPicker } from 'src/composables/useMentionPicker';
import MentionPicker from 'components/shared/MentionPicker.vue';

const auth = useAuthStore();
const authed = computed(() => !!auth.user);
const isViewingAs = computed(() => auth.isViewingAs);
const viewingAsLabel = computed(() => {
  const b = auth.viewingAs;
  if (!b) return '';
  return b.charAt(0).toUpperCase() + b.slice(1);
});
const viewingAsEmail = computed(() =>
  isViewingAs.value ? auth.viewingAs + '@compendium.local' : null
);

const state = reactive({ tabs: [], activeId: null });
const saving = ref(false);
const lastSavedAt = ref(null);
const bodyEl = ref(null);
let saveTimer = null;
let suppressNextSelect = false;

const activeTab = computed(() => state.tabs.find(t => t.id === state.activeId) || null);

function syncEditorFromState() {
  if (!bodyEl.value) return;
  const html = activeTab.value ? (activeTab.value.html || '') : '';
  if (bodyEl.value.innerHTML !== html) bodyEl.value.innerHTML = html;
}

const picker = useMentionPicker({
  onInput(el) {
    if (isViewingAs.value) return;
    if (activeTab.value) {
      activeTab.value.html = el.innerHTML;
      scheduleSave();
    }
  }
});

async function flush() {
  if (!authed.value || isViewingAs.value) return;
  if (activeTab.value && bodyEl.value) activeTab.value.html = bodyEl.value.innerHTML;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saving.value = true;
  await saveNotepad({ tabs: state.tabs, activeId: state.activeId });
  saving.value = false;
  lastSavedAt.value = new Date();
}

function scheduleSave() {
  if (!authed.value || isViewingAs.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1200);
}

function onTabClick(tab) {
  if (suppressNextSelect) { suppressNextSelect = false; return; }
  if (tab.id === state.activeId) return;
  if (!isViewingAs.value && activeTab.value && bodyEl.value) {
    activeTab.value.html = bodyEl.value.innerHTML;
  }
  state.activeId = tab.id;
}

watch(() => state.activeId, async () => {
  await nextTick();
  syncEditorFromState();
  if (!isViewingAs.value) flush();
});

function onAdd() {
  if (!authed.value || isViewingAs.value) return;
  if (activeTab.value && bodyEl.value) activeTab.value.html = bodyEl.value.innerHTML;
  const t = newTab('New');
  state.tabs.push(t);
  state.activeId = t.id;
  flush();
}

function onRenameStart(tab, e) {
  if (isViewingAs.value) return;
  suppressNextSelect = true;
  const el = e.target;
  el.contentEditable = 'true';
  el.classList.add('editing');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function onRenameEnd(tab, e) {
  if (isViewingAs.value) return;
  const el = e.target;
  el.contentEditable = 'false';
  el.classList.remove('editing');
  const v = (el.innerText || '').trim() || 'Untitled';
  tab.label = v;
  el.innerText = v;
  flush();
}
function onRenameCancel(tab, e) {
  e.target.innerText = tab.label;
  e.target.blur();
}

function onDelete(tab) {
  if (!authed.value || isViewingAs.value) return;
  if (state.tabs.length <= 1) return;
  if (!window.confirm('Delete "' + tab.label + '"?')) return;
  const idx = state.tabs.findIndex(t => t.id === tab.id);
  state.tabs.splice(idx, 1);
  if (state.activeId === tab.id) {
    const fallback = state.tabs[Math.max(0, idx - 1)] || state.tabs[0];
    state.activeId = fallback.id;
  }
  flush();
}

const relativeSaved = computed(() => {
  if (!lastSavedAt.value) return '';
  const sec = Math.round((Date.now() - lastSavedAt.value.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.round(sec / 60);
  if (min < 60) return min + 'm ago';
  return 'a while ago';
});

async function reload() {
  if (!authed.value) return;
  const loaded = await fetchNotepad(viewingAsEmail.value);
  state.tabs = loaded.tabs;
  state.activeId = loaded.activeId;
  await nextTick();
  syncEditorFromState();
  if (bodyEl.value && !isViewingAs.value) picker.bind(bodyEl.value);
}

watch(() => auth.viewingAs, reload);

onMounted(async () => {
  await reload();
  if (bodyEl.value && !isViewingAs.value) picker.bind(bodyEl.value);
});

onBeforeUnmount(() => {
  if (bodyEl.value) picker.unbind(bodyEl.value);
});
</script>

<style scoped>
.notepad-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
  min-height: 0;
}

.drawer-header {
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.hdr-title {
  font-size: var(--section-heading-size);
  letter-spacing: var(--section-heading-spacing);
  text-transform: uppercase;
  color: var(--section-heading-color);
  font-weight: bold;
}
.drawer-header .status {
  font-size: 10px;
  color: var(--text-dim);
  font-weight: normal;
}
.drawer-header .status.saving { color: var(--gold-dim); }

.notes-tabs {
  display: flex;
  background: var(--bg-panel-2);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
}
.note-tab {
  padding: 6px 12px;
  border-right: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border-top: none;
  border-bottom: none;
  border-left: none;
}
.note-tab.active {
  color: var(--gold);
  background: var(--bg-panel);
  border-bottom: 2px solid var(--gold);
}
.note-tab .label { outline: none; min-width: 30px; }
.note-tab .label.editing {
  color: var(--gold-bright);
  background: var(--bg);
  padding: 0 4px;
  border-radius: 2px;
}
.note-tab .close {
  color: var(--text-dim);
  font-size: 11px;
  padding: 0 2px;
}
.note-tab .close:hover { color: var(--red); }
.add-tab {
  background: transparent;
  border: none;
  color: var(--gold);
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
}
.add-tab:disabled { opacity: 0.4; cursor: default; }

.note-body-wrap {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.note-body {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-panel);
  color: var(--text);
  border: none;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.note-body:empty:before {
  content: var(--placeholder-notepad, "Write your notes here. Use @ to link.");
  color: var(--text-dim);
  font-style: italic;
  pointer-events: none;
}
.note-body :deep(a.mention) {
  color: var(--bold-accent-color);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--gold-dim);
  text-underline-offset: 2px;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 2px;
}
.note-body :deep(a.mention:hover) {
  background: rgba(216,201,138,0.12);
  text-decoration-color: var(--gold);
}
</style>
