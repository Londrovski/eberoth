<template>
  <div class="session-read" @click="onSurfaceClick">
    <div v-if="viewer.isDM && !loading && !error" class="dm-edit-bar">
      <button v-if="!editing" class="eb-btn" @click="startEdit">Edit</button>
      <template v-else>
        <button class="eb-btn primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
        <button class="eb-btn" :disabled="saving" @click="cancel">Cancel</button>
        <span class="eb-hint">Type @ to tag an NPC, faction or session</span>
      </template>
    </div>

    <div v-if="loading" class="state"><q-spinner size="26px" color="warning" /></div>
    <div v-else-if="error" class="state err">Couldn't load this session.</div>

    <div v-else class="surface">
      <div v-if="full.body" class="player-body">
        <div class="player-body-label">For you</div>
        <div class="player-body-text" v-html="full.body"></div>
      </div>

      <div v-if="full.summary.length" class="summary-block">
        <div class="block-label">Summary</div>
        <ul v-if="!editing" class="summary-list">
          <li v-for="line in full.summary" :key="line.id" v-html="line.line"></li>
        </ul>
        <div v-else class="edit-stack">
          <RichNoteEditor
            v-for="line in full.summary"
            :key="'s:' + line.id"
            class="sess-field"
            minimal
            :node="{ id: 's:' + line.id, html: line.line }"
            :sessions="notes.sessions"
            @change="(h) => onEdit('s:' + line.id, h)"
          />
        </div>
      </div>

      <div v-for="part in full.parts" :key="part.id" class="part-block">
        <div class="part-label">{{ part.label }}</div>
        <div v-for="b in part.blocks" :key="b.id" class="block">
          <!-- Read mode -->
          <template v-if="!editing">
            <p v-if="b.type === 'para' && b.text" class="block-para" v-html="b.text"></p>
            <div v-else-if="b.type === 'highlight' && b.text" class="block-highlight" v-html="b.text"></div>
            <div v-else-if="b.type === 'takeaway' && b.text" class="block-takeaway">
              <q-icon name="auto_awesome" size="15px" class="q-mr-xs" /><span v-html="b.text"></span>
            </div>
            <div v-else-if="b.type === 'testimonies'" class="block-testimonies">
              <p v-if="b.text" class="block-para" v-html="b.text"></p>
              <div v-for="t in b.testimonies" :key="t.id" class="testimony">
                <span class="testimony-name">{{ t.name }}:</span>
                <span class="testimony-text" v-html="t.text"></span>
              </div>
            </div>
          </template>

          <!-- Edit mode: editable block text (testimony sub-entries stay read-only for now) -->
          <template v-else>
            <RichNoteEditor
              v-if="hasText(b)"
              class="sess-field"
              minimal
              :node="{ id: 'b:' + b.id, html: b.text }"
              :sessions="notes.sessions"
              @change="(h) => onEdit('b:' + b.id, h)"
            />
            <div v-if="b.type === 'testimonies' && b.testimonies && b.testimonies.length" class="testi-ro">
              <div v-for="t in b.testimonies" :key="t.id" class="testimony">
                <span class="testimony-name">{{ t.name }}:</span>
                <span class="testimony-text" v-html="t.text"></span>
              </div>
              <div class="testi-note">Testimony lines aren't editable here yet.</div>
            </div>
          </template>
        </div>
      </div>

      <div v-if="!full.summary.length && !full.parts.length && !full.body" class="state">No content yet.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import * as sessionsApi from 'src/api/sessions';
import * as sessionsEditApi from 'src/api/sessions-edit';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useSessionDetail } from 'src/composables/useSessionDetail';
import { useNotesStore } from 'src/stores/notes';
import { useViewer } from 'src/composables/useViewer';
import { useQuasar } from 'quasar';
import RichNoteEditor from 'components/notes/editor/RichNoteEditor.vue';

const props = defineProps({ session: { type: Object, required: true } });

const detail = useEntityDetail();
const sessionDetail = useSessionDetail();
const notes = useNotesStore();
const viewer = useViewer();
const $q = useQuasar();

const loading = ref(true);
const error = ref(false);
const full = ref({ summary: [], parts: [], body: null });

const editing = ref(false);
const saving = ref(false);
const edits = reactive({}); // key 's:<id>' | 'b:<id>' -> html

function hasText(b) {
  return ['para', 'highlight', 'takeaway', 'testimonies'].includes(b.type) && !!b.text;
}

async function load(id) {
  loading.value = true; error.value = false;
  try { full.value = await sessionsApi.fetchFull(id); }
  catch { error.value = true; }
  finally { loading.value = false; }
}

function startEdit() {
  Object.keys(edits).forEach(k => delete edits[k]);
  editing.value = true;
}
function cancel() {
  Object.keys(edits).forEach(k => delete edits[k]);
  editing.value = false;
}
function onEdit(key, html) { edits[key] = html; }

async function save() {
  saving.value = true;
  try {
    for (const [key, html] of Object.entries(edits)) {
      const id = key.slice(2);
      if (key.startsWith('s:')) await sessionsEditApi.updateSummaryLine(id, html);
      else if (key.startsWith('b:')) await sessionsEditApi.updateBlockText(id, html);
    }
    await load(props.session.id);
    Object.keys(edits).forEach(k => delete edits[k]);
    editing.value = false;
    $q.notify({ type: 'positive', message: 'Session updated.' });
  } catch (e) {
    $q.notify({ type: 'negative', message: 'Save failed: ' + (e.message || String(e)) });
  } finally {
    saving.value = false;
  }
}

// Clicking an entity/session link inside a session pops the right overlay.
function onSurfaceClick(e) {
  if (editing.value) return;
  const a = e.target && e.target.closest && e.target.closest('a.mention');
  if (!a) return;
  e.preventDefault();
  const kind = a.getAttribute('data-mention-kind');
  const id = a.getAttribute('data-mention-id');
  if (!id) return;
  if (kind === 'session') {
    const s = notes.sessions.find(x => String(x.id) === String(id));
    if (s) sessionDetail.open(s, 'session');
  } else {
    detail.open(id, 'session');
  }
}

watch(() => props.session && props.session.id, (id) => { editing.value = false; if (id) load(id); }, { immediate: true });
</script>

<style scoped>
.session-read { height: 100%; overflow-y: auto; }
.surface { max-width: 880px; padding: 22px 28px 70px; color: var(--text); font-size: calc(16px * var(--nz, 1)); line-height: 1.7; }
.state { padding: 40px; text-align: center; color: var(--text-dim); font-style: italic; }
.state.err { color: var(--red); }

.dm-edit-bar {
  position: sticky; top: 0; z-index: 4;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 28px; background: var(--bg-panel-2); border-bottom: 1px solid var(--border);
}
.eb-btn {
  background: transparent; border: 1px solid var(--border); color: var(--text-dim);
  padding: 3px 12px; border-radius: 3px; font-family: inherit; font-size: 12px; cursor: pointer;
}
.eb-btn:hover:not(:disabled) { color: var(--gold); border-color: var(--gold-dim); }
.eb-btn.primary { color: var(--gold-bright); border-color: var(--gold-dim); }
.eb-btn:disabled { opacity: 0.5; cursor: default; }
.eb-hint { font-size: 10px; color: var(--text-dim); font-style: italic; margin-left: 4px; }

.player-body { border-left: 3px solid var(--gold-dim); background: rgba(201,169,97,0.08); padding: 10px 14px; border-radius: 4px; margin-bottom: 18px; }
.player-body-label { font-size: 0.78em; color: var(--gold-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
.player-body-text { line-height: 1.6; }

.block-label, .part-label { font-size: 0.9em; color: var(--gold); text-transform: uppercase; letter-spacing: 0.05em; margin: 18px 0 8px; font-weight: 600; }

.summary-list { margin: 0; padding-left: 20px; }
.summary-list li { margin-bottom: 6px; }

.block { margin-bottom: 10px; }
.block-para { margin: 0 0 8px 0; }
.block-highlight { background: rgba(201,169,97,0.12); border-left: 3px solid var(--gold-dim); padding: 8px 12px; font-style: italic; margin-bottom: 8px; border-radius: 0 4px 4px 0; }
.block-takeaway { background: rgba(201,169,97,0.10); padding: 8px 12px; border-radius: 4px; margin-bottom: 6px; display: flex; align-items: center; color: var(--gold-bright); }
.block-testimonies { margin-bottom: 8px; }
.testimony { background: var(--bg-panel-2); padding: 8px 12px; margin-bottom: 5px; border-radius: 4px; font-size: 0.95em; line-height: 1.5; }
.testimony-name { font-weight: 600; color: var(--gold); margin-right: 6px; }

.surface :deep(strong) { color: var(--bold-accent-color); font-weight: 700; }
.surface :deep(em) { font-style: italic; }

/* Inline edit fields */
.edit-stack { display: flex; flex-direction: column; gap: 4px; }
.sess-field {
  border: 1px solid var(--border); border-radius: 4px; background: var(--bg-panel-2);
  margin-bottom: 6px;
}
.sess-field :deep(.ProseMirror) { padding: 7px 10px; min-height: auto; font-size: inherit; }
.testi-ro { opacity: 0.75; margin-top: 4px; }
.testi-note { font-size: 0.75em; color: var(--text-dim); font-style: italic; margin-top: 2px; }
</style>
