<template>
  <div class="zoom-link">
    <input
      class="zl-input"
      v-model="draft"
      type="url"
      spellcheck="false"
      placeholder="https://zoom.us/j/…"
      @keydown.enter.prevent="save"
    />
    <div class="zl-actions">
      <button class="pill" :disabled="draft.trim() === current" @click="save">Save</button>
      <button class="pill" :disabled="current === defaultUrl" @click="reset">Reset</button>
      <span v-if="flash" class="zl-flash">{{ flash }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppSettingsStore } from 'src/stores/app-settings';

const app = useAppSettingsStore();
const current = computed(() => app.externalZoomUrl || '');
const defaultUrl = computed(() => app.defaultZoomUrl);

const draft = ref(current.value);
const flash = ref('');

// Keep the input in sync if the value changes elsewhere (realtime / reset).
watch(current, (v) => { draft.value = v; });

let flashTimer = null;
function showFlash(msg) {
  flash.value = msg;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flash.value = ''; }, 2000);
}

async function save() {
  await app.setZoomUrl(draft.value.trim());
  showFlash('Saved · live');
}
async function reset() {
  await app.resetZoomUrl();
  showFlash('Reset to default');
}
</script>

<style scoped>
.zoom-link { display: flex; flex-direction: column; gap: 6px; }
.zl-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 3px;
  padding: 5px 8px;
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.zl-input:focus { border-color: var(--gold-dim); }
.zl-actions { display: flex; align-items: center; gap: 6px; }
.pill {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 3px 10px;
  border-radius: 3px;
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}
.pill:hover:not(:disabled) { color: var(--gold); border-color: var(--gold-dim); }
.pill:disabled { opacity: 0.4; cursor: default; }
.zl-flash { font-size: 10px; color: var(--gold-dim); }
</style>
