<template>
  <div class="threads-panel">
    <header class="drawer-header">
      <span class="hdr-title">Active Threads</span>
      <span v-if="isViewingAs" class="viewing-as-badge">{{ viewingAsLabel }}'s threads</span>
      <button class="hdr-btn" :disabled="!authed" :title="'Add thread'" @click="add">+</button>
    </header>

    <div class="threads-list" ref="listEl">
      <div v-if="!authed" class="threads-empty">Sign in to track threads.</div>

      <template v-else>
        <div
          v-for="(t, i) in threads"
          :key="t.id"
          class="thread"
          :class="{ done: t.done }"
        >
          <label class="check-wrap" :title="'Mark complete'">
            <input
              type="checkbox"
              v-model="t.done"
              class="thread-check"
              @change="persist"
            />
            <span class="check-box" />
          </label>
          <span
            class="text"
            contenteditable="true"
            spellcheck="false"
            :data-idx="i"
            :data-thread-id="t.id"
            @blur="onTextBlur(i, $event)"
            @keydown.enter.prevent="$event.target.blur()"
          ></span>
          <button class="del" :title="'Remove'" @click="remove(t)">x</button>
        </div>
        <div v-if="!threads.length" class="threads-empty">
          <template v-if="isViewingAs">No threads for this player.</template>
          <template v-else>No active threads. Tap + to add one.</template>
        </div>
      </template>
    </div>

    <MentionPicker :picker="picker" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useAuthStore } from 'src/stores/auth';
import { fetchThreads, saveThreads } from 'src/api/threads';
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

const threads = ref([]);
const listEl = ref(null);

let saveTimer = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    threads.value.forEach((t, i) => { t.position = i; });
    await saveThreads(threads.value, viewingAsEmail.value);
  }, 300);
}

const picker = useMentionPicker({
  onInput(el) {
    const idx = parseInt(el.getAttribute('data-idx'), 10);
    if (Number.isInteger(idx) && threads.value[idx]) {
      threads.value[idx].text = el.innerHTML;
      persist();
    }
  }
});

function onTextBlur(i, e) {
  const v = (e.target.innerHTML || '').trim() || '(untitled)';
  threads.value[i].text = v;
  persist();
}

function add() {
  if (!authed.value) return;
  threads.value.push({
    id: randomId(),
    text: 'New thread',
    done: false,
    position: threads.value.length
  });
  persist();
}

function remove(thread) {
  threads.value = threads.value.filter(x => x.id !== thread.id);
  persist();
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'th_' + Math.random().toString(36).slice(2, 10);
}

function syncEditorsFromState() {
  if (!listEl.value) return;
  const focusedEl = document.activeElement;
  const nodes = Array.from(listEl.value.querySelectorAll('.text'));
  nodes.forEach(el => {
    if (el === focusedEl) return;
    const idx = parseInt(el.getAttribute('data-idx'), 10);
    if (!Number.isInteger(idx)) return;
    const t = threads.value[idx];
    const html = (t && t.text) || '';
    if (el.innerHTML !== html) el.innerHTML = html;
  });
}

let boundEls = [];
function bindAll() {
  unbindAll();
  if (!listEl.value) return;
  boundEls = Array.from(listEl.value.querySelectorAll('.text'));
  boundEls.forEach(el => picker.bind(el));
}
function unbindAll() {
  boundEls.forEach(el => picker.unbind(el));
  boundEls = [];
}

async function reload() {
  if (!authed.value) return;
  threads.value = await fetchThreads(viewingAsEmail.value);
  await nextTick();
  syncEditorsFromState();
  bindAll();
}

watch(() => auth.viewingAs, reload);
watch(() => threads.value.length, async () => {
  await nextTick();
  syncEditorsFromState();
  bindAll();
});

onMounted(reload);
onBeforeUnmount(() => { unbindAll(); });
</script>

<style scoped>
.threads-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
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
.hdr-btn {
  background: transparent;
  border: 1px solid var(--gold-dim);
  color: var(--gold);
  width: 22px;
  height: 22px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  font-family: inherit;
}
.hdr-btn:hover:not(:disabled) { background: var(--gold-dim); color: var(--bg); }
.hdr-btn:disabled { opacity: 0.4; cursor: default; }
.viewing-as-badge {
  font-size: 10px;
  color: var(--gold-dim);
  font-style: italic;
  letter-spacing: 0.5px;
}
.threads-list {
  overflow-y: auto;
  padding: 8px 10px;
  flex: 1;
  min-height: 0;
}
.thread {
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--gold-dim);
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 3px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  transition: border-color 0.15s ease;
}
.thread:focus-within { border-color: var(--gold-dim); }
.thread.done .text { color: var(--text-dim); text-decoration: line-through; }
.check-wrap {
  position: relative;
  display: inline-flex;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  cursor: pointer;
  flex-shrink: 0;
}
.thread-check {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}
.check-box {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--gold-dim);
  border-radius: 2px;
  background: transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
  display: inline-block;
  position: relative;
}
.thread-check:hover + .check-box { border-color: var(--gold); }
.thread-check:checked + .check-box {
  background: var(--gold-dim);
  border-color: var(--gold-dim);
}
.thread-check:checked + .check-box::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 4px;
  height: 8px;
  border: solid var(--bg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.thread .text {
  flex: 1;
  outline: none;
  color: var(--text);
  cursor: text;
  min-height: 18px;
  word-wrap: break-word;
}
.thread .text:focus { color: var(--gold-bright); }
.thread .text :deep(a.mention) {
  color: var(--bold-accent-color);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--gold-dim);
  text-underline-offset: 2px;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 2px;
}
.thread .text :deep(a.mention:hover) {
  background: rgba(216,201,138,0.12);
  text-decoration-color: var(--gold);
}
.thread .del {
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  font-family: inherit;
}
.thread .del:hover { color: var(--red); }
.threads-empty {
  color: var(--text-dim);
  font-style: italic;
  text-align: center;
  padding: 12px;
  font-size: 13px;
}
</style>
