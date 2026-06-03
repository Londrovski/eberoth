<template>
  <section class="notes-section q-mt-md">
    <div class="section-label">
      <span v-if="isViewingAs">{{ viewingAsLabel }}'s notes</span>
      <span v-else>Your notes</span>
    </div>
    <div
      class="notes-input"
      :contenteditable="authed"
      spellcheck="true"
      ref="bodyEl"
      @blur="flush"
    ></div>
    <div class="status" :class="{ saving }">
      <span v-if="saving">Saving...</span>
      <span v-else-if="lastSavedAt">Saved {{ relativeSaved }}</span>
      <span v-else-if="!authed">Sign in to take notes</span>
    </div>
    <MentionPicker :picker="picker" />
  </section>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useAuthStore } from 'src/stores/auth';
import * as notesApi from 'src/api/notes';
import { useMentionPicker } from 'src/composables/useMentionPicker';
import MentionPicker from 'components/shared/MentionPicker.vue';

const props = defineProps({
  entityId: { type: String, required: true }
});

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

const saving = ref(false);
const lastSavedAt = ref(null);
const bodyEl = ref(null);
let saveTimer = null;
let loadedFor = null;
let currentHtml = '';

const picker = useMentionPicker({
  onInput(/* el */) {
    debouncedSave();
  }
});

async function load(id) {
  if (!authed.value) return;
  loadedFor = id;
  const v = await notesApi.fetch(id, viewingAsEmail.value);
  if (loadedFor !== id) return;
  currentHtml = v || '';
  lastSavedAt.value = v ? new Date() : null;
  await nextTick();
  if (bodyEl.value) bodyEl.value.innerHTML = currentHtml;
}

async function flush() {
  if (!authed.value) return;
  if (bodyEl.value) currentHtml = bodyEl.value.innerHTML;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  saving.value = true;
  await notesApi.save(props.entityId, currentHtml || '', viewingAsEmail.value);
  saving.value = false;
  lastSavedAt.value = new Date();
}

function debouncedSave() {
  if (!authed.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 1500);
}

// Reload when entityId changes or when DM switches who they're viewing as.
watch(() => props.entityId, async (id) => {
  currentHtml = '';
  lastSavedAt.value = null;
  if (bodyEl.value) bodyEl.value.innerHTML = '';
  if (id) await load(id);
}, { immediate: false });

watch(() => auth.viewingAs, async () => {
  currentHtml = '';
  lastSavedAt.value = null;
  if (bodyEl.value) bodyEl.value.innerHTML = '';
  if (props.entityId) await load(props.entityId);
});

onMounted(async () => {
  if (props.entityId) await load(props.entityId);
  await nextTick();
  if (bodyEl.value) picker.bind(bodyEl.value);
});
onBeforeUnmount(() => {
  if (bodyEl.value) picker.unbind(bodyEl.value);
});

const relativeSaved = computed(() => {
  if (!lastSavedAt.value) return '';
  const sec = Math.round((Date.now() - lastSavedAt.value.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.round(sec / 60);
  if (min < 60) return min + 'm ago';
  return 'a while ago';
});
</script>

<style scoped>
.section-label {
  font-size: var(--section-heading-size);
  letter-spacing: var(--section-heading-spacing);
  text-transform: uppercase;
  color: var(--section-heading-color);
  margin-bottom: 6px;
}
.notes-input {
  width: 100%;
  min-height: 90px;
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px 12px;
  color: var(--body-card-color);
  font-size: var(--body-card-size);
  line-height: 1.55;
  outline: none;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.notes-input:empty:before {
  content: var(--placeholder-detail-notes, "Personal notes about this entity. Only you can see these.");
  color: var(--text-dim);
  font-style: italic;
  pointer-events: none;
}
.notes-input:focus { border-color: var(--gold-dim); }
.notes-input :deep(a.mention) {
  color: var(--bold-accent-color);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--gold-dim);
  text-underline-offset: 2px;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 2px;
}
.notes-input :deep(a.mention:hover) {
  background: rgba(216,201,138,0.12);
  text-decoration-color: var(--gold);
}
.status {
  font-size: 0.7rem;
  color: var(--text-dim);
  margin-top: 4px;
  min-height: 1em;
}
.status.saving { color: var(--gold); }
</style>
