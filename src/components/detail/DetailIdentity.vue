<template>
  <div class="identity column items-center text-center q-mb-md">
    <div class="avatar-wrap">
      <EntityAvatar :entity="entity" fill detail />
    </div>
    <div class="name q-mt-md" :class="{ dead: entity.is_dead }">{{ entity.name }}<span v-if="entity.is_dead"> — Dead</span></div>
    <div class="sub q-mt-xs" v-if="entity.sub">{{ entity.sub }}</div>
    <div class="kind q-mt-xs">{{ kindLabel }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import EntityAvatar from 'components/shared/EntityAvatar.vue';

const props = defineProps({
  entity: { type: Object, required: true }
});

const KIND_LABEL = {
  player:  'Player Character',
  faction: 'Faction',
  npc:     'Person',
  lore:    'Lore'
};
const kindLabel = computed(() => KIND_LABEL[props.entity.kind] || props.entity.kind);
</script>

<style scoped>
.identity { padding: 0 0 8px; }
.avatar-wrap {
  width: 100%;
  max-width: 300px;
}
.name.dead { color: #cf5a52; }
.name {
  font-size: 1.6rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--gold);
}
.sub {
  font-size: 0.95rem;
  color: var(--text-dim);
  font-style: italic;
  max-width: 100%;
}
.kind {
  font-size: var(--section-heading-size);
  letter-spacing: var(--section-heading-spacing);
  text-transform: uppercase;
  color: var(--section-heading-color);
}
</style>
