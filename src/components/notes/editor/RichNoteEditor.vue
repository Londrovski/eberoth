<template>
  <div class="rich-editor">
    <div v-if="editable && !minimal" class="toolbar">
      <button class="tb" :class="{ on: is('bold') }" title="Bold" @mousedown.prevent="run(c=>c.toggleBold())"><b>B</b></button>
      <button class="tb" :class="{ on: is('italic') }" title="Italic" @mousedown.prevent="run(c=>c.toggleItalic())"><i>I</i></button>
      <button class="tb" :class="{ on: is('underline') }" title="Underline" @mousedown.prevent="run(c=>c.toggleUnderline())"><u>U</u></button>
      <button class="tb" :class="{ on: is('strike') }" title="Strikethrough" @mousedown.prevent="run(c=>c.toggleStrike())"><s>S</s></button>
      <span class="sep"></span>
      <button class="tb" :class="{ on: is('bulletList') }" title="Bullet list" @mousedown.prevent="run(c=>c.toggleBulletList())">•</button>
      <button class="tb" :class="{ on: is('orderedList') }" title="Numbered list" @mousedown.prevent="run(c=>c.toggleOrderedList())">1.</button>
      <button class="tb" :class="{ on: is('taskList') }" title="Checklist" @mousedown.prevent="run(c=>c.toggleTaskList())">☑</button>
      <button class="tb" :class="{ on: is('heading',{level:2}) }" title="Heading" @mousedown.prevent="run(c=>c.toggleHeading({level:2}))">H</button>
      <button class="tb" :class="{ on: is('blockquote') }" title="Quote" @mousedown.prevent="run(c=>c.toggleBlockquote())">&ldquo;</button>
      <span class="sep"></span>

      <div class="menu" @mouseleave="openMenu=null">
        <button class="tb" title="Highlight" @mousedown.prevent="toggle('hl')"><span class="swatch-ico" style="background:#e6c87c"></span>▾</button>
        <div v-if="openMenu==='hl'" class="pop">
          <button v-for="col in highlights" :key="col" class="swatch" :style="{background:col}" @mousedown.prevent="setHighlight(col)"></button>
          <button class="swatch clear" title="Clear" @mousedown.prevent="run(c=>c.unsetHighlight())">✕</button>
        </div>
      </div>

      <div class="menu" @mouseleave="openMenu=null">
        <button class="tb" title="Text colour" @mousedown.prevent="toggle('col')"><span class="ink">A</span>▾</button>
        <div v-if="openMenu==='col'" class="pop">
          <button v-for="col in colours" :key="col" class="swatch" :style="{background:col}" @mousedown.prevent="setColour(col)"></button>
          <button class="swatch clear" title="Default" @mousedown.prevent="run(c=>c.unsetColor())">✕</button>
        </div>
      </div>

      <span class="sep"></span>
      <button class="tb" title="Clear formatting" @mousedown.prevent="run(c=>c.unsetAllMarks().clearNodes())">⌫</button>
      <span class="hint">Type @ to link an NPC, faction or session</span>
    </div>

    <editor-content class="surface" :editor="editor" />
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import { buildMention } from './mention';
import { useEntitiesStore } from 'src/stores/entities';
import { useEntityDetail } from 'src/composables/useEntityDetail';
import { useSessionDetail } from 'src/composables/useSessionDetail';

const props = defineProps({
  node: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  minimal: { type: Boolean, default: false },
  sessions: { type: Array, default: () => [] }
});
const emit = defineEmits(['change']);

const entities = useEntitiesStore();
const detail = useEntityDetail();
const sessionDetail = useSessionDetail();

const highlights = ['#e6c87c', '#9ec7a0', '#7fb0d8', '#d89a9a', '#c4a7e0', '#d8d08a'];
const colours = ['#e8e2d4', '#e6c87c', '#9ec7a0', '#7fb0d8', '#d89a9a', '#c4a7e0', '#8b3a3a'];
const openMenu = ref(null);
function toggle(m) { openMenu.value = openMenu.value === m ? null : m; }

function getItems(query) {
  const q = (query || '').trim().toLowerCase();
  const ents = entities.all
    .filter((e) => e && e.name && (!q || (e.short_name || e.name).toLowerCase().includes(q)))
    .slice(0, 8)
    .map((e) => ({ kind: 'entity', id: e.id, label: e.short_name || e.name, type: e.kind }));
  const sess = (props.sessions || [])
    .map((s) => {
      const prequel = !!s.kind;            // origin / flashback / prequel: no number
      const n = s.number ?? 0;
      const label = prequel
        ? (s.title || '')
        : ('Session ' + n + (s.title ? ' - ' + s.title : ''));
      // searchable text: numbered sessions match on "session", the number, and the title
      const search = (prequel
        ? (s.title || '')
        : ('session ' + n + ' ' + (s.title || '') + ' ' + n)).toLowerCase();
      return { kind: 'session', id: s.id, label, type: 'session', search, rank: prequel ? 1000 + n : n };
    })
    .filter((it) => !q || it.search.includes(q))
    .sort((a, b) => a.rank - b.rank)   // numbered sessions first, in order
    .slice(0, 8);
  return [...ents, ...sess];
}

let syncing = false;

const editor = useEditor({
  content: props.node ? props.node.html : '',
  editable: props.editable,
  extensions: [
    StarterKit,
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    Placeholder.configure({ placeholder: 'Start writing…  Use @ to link an NPC, faction or session.' }),
    buildMention({ getItems })
  ],
  editorProps: {
    handleClickOn: (view, pos, node, nodePos, event) => {
      const a = event.target && event.target.closest && event.target.closest('a.mention');
      if (!a) return false;
      event.preventDefault();
      const kind = a.getAttribute('data-mention-kind');
      const id = a.getAttribute('data-mention-id');
      if (!id) return false;
      if (kind === 'session') {
        const s = (props.sessions || []).find((x) => String(x.id) === String(id));
        if (s) sessionDetail.open(s, 'note');
      } else {
        detail.open(id, 'note');
      }
      return true;
    }
  },
  onUpdate: ({ editor }) => {
    if (syncing) return;
    emit('change', editor.getHTML());
  }
});

function run(fn) {
  if (!editor.value) return;
  fn(editor.value.chain().focus()).run();
  openMenu.value = null;
}
function is(name, attrs) { return editor.value ? editor.value.isActive(name, attrs) : false; }
function setHighlight(col) { run((c) => c.toggleHighlight({ color: col })); }
function setColour(col) { run((c) => c.setColor(col)); }

// Swap content when the selected note changes, without firing a save.
watch(() => props.node && props.node.id, async () => {
  if (!editor.value) return;
  syncing = true;
  editor.value.commands.setContent(props.node ? props.node.html || '' : '', false);
  syncing = false;
});
watch(() => props.editable, (v) => { if (editor.value) editor.value.setEditable(v); });

onBeforeUnmount(() => { if (editor.value) editor.value.destroy(); });
</script>

<style scoped>
.rich-editor { display: flex; flex-direction: column; height: 100%; min-height: 0; }

.toolbar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel-2);
  position: sticky; top: 0; z-index: 5;
}
.tb {
  min-width: 30px; height: 30px; padding: 0 8px;
  background: transparent; border: 1px solid transparent; border-radius: 4px;
  color: var(--text-dim); cursor: pointer; font-size: 15px; font-family: inherit;
  display: inline-flex; align-items: center; justify-content: center;
}
.tb:hover { color: var(--gold-bright); background: rgba(201,169,97,0.12); }
.tb.on { color: var(--gold); border-color: var(--gold-dim); background: rgba(201,169,97,0.16); }
.sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
.ink { color: var(--gold); font-weight: 700; }
.swatch-ico { display:inline-block; width:11px; height:11px; border-radius:2px; margin-right:1px; }
.hint { font-size: 10px; color: var(--text-dim); font-style: italic; margin-left: auto; padding-left: 8px; }

.menu { position: relative; display: inline-flex; }
.pop {
  position: absolute; top: 28px; left: 0; z-index: 20;
  display: flex; gap: 4px; padding: 6px;
  background: var(--bg-panel); border: 1px solid var(--gold-dim); border-radius: 5px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.5);
}
.swatch { width: 18px; height: 18px; border-radius: 3px; border: 1px solid var(--border); cursor: pointer; padding: 0; }
.swatch.clear { background: var(--bg-panel-2); color: var(--text-dim); font-size: 11px; }

.surface { flex: 1; overflow-y: auto; min-height: 0; }
</style>
