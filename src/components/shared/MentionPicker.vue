<template>
  <Teleport to="body">
    <div
      v-if="picker.isOpen.value && picker.results.value.length"
      class="mention-picker"
      :style="{ top: picker.position.value.top + 'px', left: picker.position.value.left + 'px' }"
    >
      <div
        v-for="(r, idx) in picker.results.value"
        :key="r.kind + ':' + r.id"
        class="row"
        :class="{ selected: idx === picker.selectedIndex.value }"
        @mousedown.prevent="onClick(idx)"
      >
        <span class="kind" :data-kind="r.type">{{ kindLabel(r.type) }}</span>
        <span class="label">{{ r.label }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  picker: { type: Object, required: true }
});

function kindLabel(t) {
  if (t === 'npc')     return 'NPC';
  if (t === 'faction') return 'Faction';
  if (t === 'lore')    return 'Lore';
  if (t === 'player')  return 'Player';
  if (t === 'session') return 'Session';
  return '';
}

function onClick(idx) {
  props.picker.selectedIndex.value = idx;
  props.picker.commit();
}
</script>

<style scoped>
.mention-picker {
  position: fixed;
  /* Above Quasar's dialog overlay (~6000) so the @ menu shows in front of
     the entity/session detail card, not behind it. */
  z-index: 7000;
  background: var(--bg-panel);
  border: 1px solid var(--gold-dim);
  border-radius: 4px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.55);
  min-width: 220px;
  max-width: 320px;
  padding: 4px 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}
.row:hover, .row.selected {
  background: var(--bg-panel-2);
  color: var(--gold-bright);
}
.kind {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--gold-dim);
  min-width: 52px;
}
.kind[data-kind="session"] { color: #cfe1ff; }
.kind[data-kind="faction"] { color: var(--gold); }
.kind[data-kind="player"]  { color: var(--gold-bright); }
.label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
