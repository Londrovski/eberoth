<template>
  <q-btn-dropdown
    flat dense no-caps
    icon="settings"
    label="DM Tools"
    class="dm-btn"
    menu-anchor="bottom right"
    menu-self="top right"
  >
    <div class="dm-menu" @click.stop>

      <div class="dm-label">Zoom link</div>
      <ZoomLinkControl />

      <q-separator class="sep" />

      <div class="dm-label">Card scale</div>
      <CardScaleControls which="card" />

      <q-separator class="sep" />

      <div class="dm-label">Faction scale</div>
      <CardScaleControls which="faction" />

      <q-separator class="sep" />

      <div class="dm-label">Personals</div>
      <div class="row items-center q-gutter-xs">
        <button
          class="pill"
          :class="{ active:  layout.showPersonals }"
          @click="setPersonals(true)"
        >Show</button>
        <button
          class="pill"
          :class="{ active: !layout.showPersonals }"
          @click="setPersonals(false)"
        >Hide</button>
      </div>

      <q-separator class="sep" />

      <div class="dm-label">Background</div>
      <BackgroundControls />

      <q-separator class="sep" />

      <div class="dm-label">Lines &amp; spacing</div>
      <LinesControls />

      <q-separator class="sep" />

      <div class="dm-label">Typography</div>
      <TypographyControls />

      <q-separator class="sep" />

      <div class="dm-label">Placeholders</div>
      <PlaceholderControls />

      <q-separator class="sep" />

      <div class="dm-label">Quick add</div>
      <div class="column q-gutter-xs">
        <button class="add-row" @click="openAdd('faction')">+ New faction</button>
        <button class="add-row" @click="openAdd('npc')">+ New NPC</button>
        <button class="add-row" @click="openAdd('lore')">+ New lore</button>
      </div>
    </div>
  </q-btn-dropdown>

  <NewEntityDialog v-if="adding" :kind="adding" @close="adding = null" />
</template>

<script setup>
import { ref } from 'vue';
import ZoomLinkControl from 'components/topbar/ZoomLinkControl.vue';
import CardScaleControls from 'components/topbar/CardScaleControls.vue';
import TypographyControls from 'components/topbar/TypographyControls.vue';
import BackgroundControls from 'components/topbar/BackgroundControls.vue';
import LinesControls from 'components/topbar/LinesControls.vue';
import PlaceholderControls from 'components/topbar/PlaceholderControls.vue';
import NewEntityDialog from 'components/topbar/NewEntityDialog.vue';
import { useAppSettingsStore } from 'src/stores/app-settings';

const layout = useAppSettingsStore();

const adding = ref(null);
function openAdd(kind) { adding.value = kind; }
function setPersonals(v) { layout.setShowPersonals(v); }
</script>

<style scoped>
.dm-btn {
  color: var(--gold-dim);
  font-size: 11px;
}
.dm-btn:hover { color: var(--gold); }

.dm-menu {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 14px;
  min-width: 280px;
}
.dm-label {
  font-size: 10px;
  color: var(--gold-dim);
  margin-bottom: 4px;
}
.sep { background: var(--border); margin: 10px 0; }

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
.pill:hover { color: var(--gold); border-color: var(--gold-dim); }
.pill.active {
  background: var(--gold-dim);
  border-color: var(--gold-dim);
  color: var(--bg);
}

.add-row {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--gold-dim);
  padding: 4px 8px;
  border-radius: 3px;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.add-row:hover { color: var(--gold); border-color: var(--gold-dim); background: var(--bg-panel-2); }
</style>
