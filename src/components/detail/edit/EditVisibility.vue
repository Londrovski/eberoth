<template>
  <section class="edit-section">
    <div class="section-label">Visibility</div>
    <div class="text-caption text-grey-7 q-mb-sm">
      Who can see this entity. Tick * for everyone.
    </div>
    <div class="row q-gutter-md">
      <q-checkbox
        :model-value="modelValue.includes('*')"
        label="Everyone"
        @update:model-value="(v) => toggle('*', v)"
      />
      <q-checkbox
        v-for="p in players"
        :key="p.bucket"
        :model-value="modelValue.includes(p.bucket)"
        :label="p.characterName"
        @update:model-value="(v) => toggle(p.bucket, v)"
      />
    </div>

    <div class="dead-row">
      <q-checkbox
        :model-value="dead"
        label="Dead"
        @update:model-value="(v) => emit('update:dead', v)"
      />
      <div class="text-caption text-grey-7">
        Marks this character as dead — death cross on cards, red glow and “— Dead” in the detail view.
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { allPlayers } from 'src/config/players';

const props = defineProps({
  modelValue: { type: Array, required: true },
  dead: { type: Boolean, default: false }
});
const emit  = defineEmits(['update:modelValue', 'update:dead']);

// Drive labels from the canonical players.js so they can't drift.
const players = computed(() => allPlayers());

function toggle(value, checked) {
  const next = new Set(props.modelValue);
  if (checked) next.add(value); else next.delete(value);
  emit('update:modelValue', [...next]);
}
</script>

<style scoped>
.edit-section { margin-bottom: 1.25rem; }
.dead-row { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
.section-label {
  font-size: 0.7rem;
  color: #8a7148;
  margin-bottom: 8px;
}
</style>
