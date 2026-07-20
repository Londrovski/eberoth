<template>
  <div class="obs-api">
    <input
      class="oa-input"
      v-model="url"
      type="url"
      spellcheck="false"
      placeholder="http://127.0.0.1:27123"
      @keydown.enter.prevent="save"
    />
    <input
      class="oa-input"
      v-model="key"
      type="password"
      spellcheck="false"
      placeholder="API key (Local REST API plugin)"
      @keydown.enter.prevent="save"
    />
    <div class="oa-actions">
      <button class="pill" :disabled="!dirty" @click="save">Save</button>
      <button class="pill" @click="test">Test</button>
      <button class="pill" :disabled="isDefault" @click="reset">Reset</button>
      <span v-if="flash" class="oa-flash" :class="flashCls">{{ flash }}</span>
    </div>
    <div class="oa-hint">DM-only · reads your vault from this machine (desktop, Obsidian open).</div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useAppSettingsStore } from 'src/stores/app-settings';

const app = useAppSettingsStore();

const url = ref(app.obsidianApi?.baseUrl || '');
const key = ref(app.obsidianApi?.apiKey || '');
const flash = ref('');
const flashCls = ref('');

const current = computed(() => app.obsidianApi || { baseUrl: '', apiKey: '' });
const defaults = computed(() => app.defaultObsidianApi);
const dirty = computed(() =>
  url.value.trim() !== (current.value.baseUrl || '') ||
  key.value.trim() !== (current.value.apiKey || ''));
const isDefault = computed(() =>
  (current.value.baseUrl || '') === defaults.value.baseUrl &&
  (current.value.apiKey || '') === defaults.value.apiKey);

watch(current, (v) => { url.value = v.baseUrl || ''; key.value = v.apiKey || ''; });

let timer = null;
function showFlash(msg, cls = '') {
  flash.value = msg; flashCls.value = cls;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { flash.value = ''; flashCls.value = ''; }, 3000);
}

async function save() {
  await app.setObsidianApi({ baseUrl: url.value.trim(), apiKey: key.value.trim() });
  showFlash('Saved · live', 'ok');
}
async function reset() {
  await app.resetObsidianApi();
  showFlash('Reset to default');
}
async function test() {
  const base = url.value.trim().replace(/\/$/, '');
  if (!base || !key.value.trim()) { showFlash('Set URL + key first', 'err'); return; }
  try {
    const res = await fetch(`${base}/vault/`, {
      headers: { Authorization: `Bearer ${key.value.trim()}`, Accept: 'application/json' }
    });
    if (res.ok) showFlash('Connected ✓', 'ok');
    else showFlash(`Reached, got ${res.status}`, 'err');
  } catch (e) {
    showFlash('Blocked — see note below', 'err');
  }
}
</script>

<style scoped>
.obs-api { display: flex; flex-direction: column; gap: 6px; }
.oa-input {
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
.oa-input:focus { border-color: var(--gold-dim); }
.oa-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
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
.oa-flash { font-size: 10px; color: var(--gold-dim); }
.oa-flash.ok { color: #8fbf6f; }
.oa-flash.err { color: #d98a7a; }
.oa-hint { font-size: 9px; color: var(--text-dim); line-height: 1.4; }
</style>
