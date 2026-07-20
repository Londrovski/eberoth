<template>
  <q-page class="dm-page">
    <div v-if="!vault.configured.value" class="dm-empty">
      <div class="dm-empty-card">
        <div class="dm-empty-title">DM View</div>
        <p>Point this at your Obsidian vault to read it live. Open <strong>DM Tools &rarr; Obsidian API</strong> and set the URL (e.g. <code>https://127.0.0.1:27124</code>) and the API key from the Local REST API plugin.</p>
        <p class="dm-empty-note">Reads your vault directly from your machine &mdash; desktop only, nothing leaves your computer.</p>
      </div>
    </div>

    <template v-else>
      <div class="dm-shell">
        <aside class="dm-side">
          <div class="dm-brand">
            <div class="dm-brand-title">DM View</div>
            <div class="dm-brand-sub">Live from vault</div>
          </div>
          <nav class="dm-nav">
            <button v-for="s in SECTIONS" :key="s.id" class="dm-nav-item" :class="{ active: section === s.id }" @click="section = s.id">
              <span class="ic">{{ s.ic }}</span>{{ s.label }}
            </button>
          </nav>
          <div class="dm-side-foot">
            <button class="dm-refresh" :disabled="vault.loading.value" @click="reload">
              <q-icon name="refresh" size="14px" /> {{ vault.loading.value ? 'Reading…' : 'Refresh' }}
            </button>
          </div>
        </aside>

        <section class="dm-main">
          <div v-if="vault.loading.value && !anyData" class="dm-loading">Reading the vault…</div>
          <div v-else-if="vault.error.value" class="dm-error">
            <strong>Couldn't read the vault.</strong>
            <p>{{ vault.error.value }}</p>
            <button class="dm-refresh" @click="reload">Try again</button>
          </div>

          <!-- PLAYERS -->
          <div v-else-if="section === 'players'">
            <div class="dm-head">
              <div class="eyebrow">The Party</div><h2>Players</h2>
              <p class="lead">Your PCs, read from the vault. Click for the full write-up.</p>
            </div>
            <div v-if="!vault.players.value.length" class="dm-none">No player files found.</div>
            <div class="grid g-players">
              <div v-for="p in vault.players.value" :key="p.id" class="dm-card pcard" @click="openPlayer(p)">
                <div class="por" :class="{ noimg: !p.img }">
                  <img v-if="p.img" :src="p.img" @error="imgErr" alt=""><span v-else>◈</span>
                </div>
                <div class="body">
                  <div class="name">{{ p.name }}</div>
                  <div class="who">{{ p.player }}</div>
                  <div class="cls">{{ p.class || p.role }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- FACTIONS -->
          <div v-else-if="section === 'factions'">
            <div class="dm-head">
              <div class="eyebrow">Houses · Crown · Orders</div><h2>Factions</h2>
              <p class="lead">Every faction. Open one for the full dossier and its connected NPCs.</p>
            </div>
            <div class="grid g-fac">
              <div v-for="f in vault.factions.value" :key="f.id" class="dm-card fcard" @click="openFaction(f)">
                <div class="top">
                  <div class="crest" :class="{ noimg: !f.sigil }">
                    <img v-if="f.sigil" :src="f.sigil" @error="imgErr" alt=""><span v-else>⛨</span>
                  </div>
                  <div class="tt">
                    <h3>{{ f.name }}</h3><div class="kind">{{ f.kind }}</div>
                    <div v-if="f.head && f.head !== '—'" class="head">Head: {{ f.head }}</div>
                  </div>
                </div>
                <div class="status clamp3">{{ plain(f.status) }}</div>
                <div class="metarow"><span class="chip">{{ f.npcs.length }} NPCs</span></div>
              </div>
            </div>
          </div>

          <!-- NPCS -->
          <div v-else-if="section === 'npcs'">
            <div class="dm-head">
              <div class="eyebrow">The Cast</div><h2>NPCs</h2>
              <p class="lead">{{ vault.npcs.value.length }} NPCs, grouped by faction. Click for staging, knowledge layers, and DM secrets.</p>
            </div>
            <div v-for="grp in npcGroups" :key="grp.faction" class="dm-lane">
              <div class="lane-head"><h3>{{ grp.faction }}</h3><span class="count">{{ grp.list.length }}</span></div>
              <div class="grid g-npc">
                <div v-for="n in grp.list" :key="n.id" class="dm-card ncard" :class="{ dead: n.status === 'dead' }" @click="openNpc(n)">
                  <div class="por" :class="{ noimg: !n.img }">
                    <img v-if="n.img" :src="n.img" @error="imgErr" alt=""><span v-else>{{ n.name.charAt(0) }}</span>
                    <div class="badge"><h4>{{ n.name }}</h4><div class="role">{{ n.role }}</div></div>
                  </div>
                  <div class="meta">
                    <span class="dot" :class="'d-' + (n.status === 'dead' ? 'dead' : (n.status === 'dormant' ? 'dormant' : 'active'))"></span>
                    <span class="fac">{{ n.lastSession ? 'Last: S' + n.lastSession : 'Unseen' }}</span>
                    <span class="disp" :class="n.disposition">{{ n.disposition }}</span>
                  </div>
                  <div class="sit clamp2">{{ plain(n.currentSituation) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- STORY -->
          <div v-else-if="section === 'story'">
            <div class="dm-head">
              <div class="eyebrow">The Machinery</div><h2>Lore · Threads · Beats</h2>
              <p class="lead">Threads are the live tensions; Lore the standing truth; Beats the plantable moves.</p>
            </div>
            <div class="dm-notice">
              <strong>Beats</strong> have no vault folder yet — the beats below are drawn from each thread's next-beat. Deciding where beats live is the one open data question.
            </div>

            <div class="dm-lane">
              <div class="lane-head"><h3>Threads</h3><span class="count">{{ vault.threads.value.length }}</span><span class="desc">Live tensions between forces</span></div>
              <div class="grid g-lore">
                <div v-for="t in vault.threads.value" :key="t.id" class="tcard thread" @click="openThread(t)">
                  <h4>{{ t.name }}</h4>
                  <div class="tension clamp3">{{ plain(t.tension) }}</div>
                  <div class="tfoot">
                    <span class="state" :class="t.state">{{ t.state }}</span>
                    <span v-if="t.lastMoved" class="pushtag">last moved <b>S{{ t.lastMoved }}</b></span>
                  </div>
                </div>
              </div>
            </div>

            <div class="dm-lane">
              <div class="lane-head"><h3>Lore</h3><span class="count">{{ vault.lore.value.length }}</span><span class="desc">Standing cosmic truth</span></div>
              <div class="grid g-lore">
                <div v-for="l in vault.lore.value" :key="l.id" class="tcard" @click="openLore(l)">
                  <h4>{{ l.name }}</h4>
                  <div class="tension clamp3">{{ plain(firstPara(l.body)) }}</div>
                  <div v-if="l.revealState" class="tfoot"><span class="pushtag" style="color:var(--dm-gold)">{{ plain(l.revealState).split('—')[0] }}</span></div>
                </div>
              </div>
            </div>

            <div class="dm-lane">
              <div class="lane-head"><h3>Beats</h3><span class="count ph">placeholder</span><span class="desc">Plantable moves — from each thread's next-beat</span></div>
              <div class="grid g-lore">
                <div v-for="(b, idx) in beats" :key="idx" class="tcard beat">
                  <span class="ph-badge">from thread</span>
                  <h4 style="font-size:15px">{{ b.thread }}</h4>
                  <div class="tension clamp2">{{ plain(b.text) }}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Detail drawer -->
      <div class="dm-scrim" :class="{ on: !!detail }" @click="detail = null"></div>
      <div class="dm-drawer" :class="{ on: !!detail }" @click="onDrawerClick">
        <button class="dclose" @click.stop="detail = null">✕</button>
        <div v-if="detail" v-html="detailHtml"></div>
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useObsidianVault } from 'src/composables/useObsidianVault';
import { renderMarkdown } from 'src/composables/dmMarkdown';

const vault = useObsidianVault();
const resolve = (name) => vault.resolveLink(name);
const R = (md) => renderMarkdown(md, resolve);
function plain(md) {
  if (!md) return '';
  return String(md)
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b || a))
    .replace(/[*#`>]/g, '').replace(/\s+/g, ' ').trim();
}

const SECTIONS = [
  { id: 'players', ic: '◈', label: 'Players' },
  { id: 'factions', ic: '⛨', label: 'Factions' },
  { id: 'npcs', ic: '☗', label: 'NPCs' },
  { id: 'story', ic: '❈', label: 'Lore · Threads · Beats' }
];
const section = ref('players');
const detail = ref(null);
const detailHtml = ref('');

const anyData = computed(() =>
  vault.npcs.value.length || vault.factions.value.length ||
  vault.threads.value.length || vault.lore.value.length);

const FACTION_ORDER = ['House Halvorn', 'House Corvath', 'House Gorrund', 'House Voss', 'The Crown'];
const npcGroups = computed(() => {
  const by = {};
  for (const n of vault.npcs.value) { (by[n.faction] = by[n.faction] || []).push(n); }
  const names = Object.keys(by).sort((a, b) => {
    const ia = FACTION_ORDER.indexOf(a), ib = FACTION_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return names.map(faction => ({ faction: faction === '—' ? 'Cosmic / Unaligned' : faction, list: by[faction] }));
});

const beats = computed(() => vault.threads.value.filter(t => t.nextBeat).map(t => ({ thread: t.name, text: t.nextBeat })));

function firstPara(body) {
  if (!body) return '';
  const clean = body.replace(/^#.*$/gm, '').replace(/^>.*$/gm, '').trim();
  return clean.split('\n').filter(Boolean)[0] || '';
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function reload() { vault.loadAll(); }
function imgErr(e) { e.target.style.display = 'none'; if (e.target.parentElement) e.target.parentElement.classList.add('noimg'); }

function fieldSec(t, md, cls = '') { return md ? `<div class="sec ${cls}"><div class="sh">${esc(t)}</div><div class="md">${R(md)}</div></div>` : ''; }

function openNpc(n) {
  let b = '';
  if (n.thin) b += `<div class="thin-note">Sparse card — only the fields the vault holds are shown.</div>`;
  b += fieldSec('Current Situation', n.currentSituation);
  b += fieldSec('Context', n.context);
  b += fieldSec('Staging', n.staging);
  b += `<div class="two">${fieldSec('Desires', n.desires)}${fieldSec('Actions', n.actions)}</div>`;
  if (n.characterKnowledge || n.playerKnowledge || n.dmSecrets) {
    b += `<div class="sec"><div class="sh">Knowledge Layers</div></div>`;
    b += fieldSec('Character Knowledge', n.characterKnowledge);
    b += fieldSec('Player Knowledge', n.playerKnowledge);
    b += fieldSec('DM Secrets', n.dmSecrets, 'dm');
  }
  b += fieldSec('Forward Projection', n.forwardProjection);
  b += fieldSec('Open Questions', n.openQuestions);
  if (n.linkedThreads.length) b += `<div class="sec"><div class="sh">Linked Threads</div><div class="md">${R(n.linkedThreads.map(x => '- ' + x).join('\n'))}</div></div>`;
  b += fieldSec('Log', n.log);
  const head = `<div class="dhead">
    <div class="dpor ${n.img ? '' : 'noimg'}">${n.img ? `<img src="${n.img}">` : esc(n.name.charAt(0))}</div>
    <div style="flex:1"><h2>${esc(n.name)}</h2><div class="drole">${esc(n.role)}</div>
    <div class="dtags"><span class="chip">${esc(n.faction)}</span><span class="chip">${esc(n.disposition)}</span><span class="chip">${esc(n.status)}</span></div></div></div>`;
  showDetail(head, b);
}

function openFaction(f) {
  let b = '';
  b += fieldSec('Status', f.status);
  b += `<div class="two">${fieldSec('Strengths', f.strengths)}${fieldSec('Weaknesses', f.weaknesses)}</div>`;
  b += fieldSec('Alignment', f.alignment);
  b += `<div class="two">${fieldSec('Short-Term Goals', f.goalsShort)}${fieldSec('Long-Term Goals', f.goalsLong)}</div>`;
  b += fieldSec('Territory', f.territory);
  b += fieldSec('Player Connections', f.playerConnections);
  b += fieldSec('Relations', f.relations);
  b += fieldSec('Threads', f.threads);
  b += fieldSec('Open Questions', f.openQuestions);
  b += fieldSec('Log', f.log);
  if (f.npcs.length) {
    b += `<div class="sec"><div class="sh">Connected NPCs</div><div>${f.npcs.map(n =>
      `<span class="linknpc" data-kind="npc" data-id="${esc(n.id)}">${n.img ? `<img class="av" src="${n.img}">` : `<span class="av noimg">${esc(n.name.charAt(0))}</span>`}${esc(n.name)}</span>`).join('')}</div></div>`;
  }
  const head = `<div class="dhead">
    <div class="dpor ${f.sigil ? '' : 'noimg'}" style="height:120px">${f.sigil ? `<img src="${f.sigil}" style="object-position:center">` : '⛨'}</div>
    <div style="flex:1"><h2>${esc(f.name)}</h2><div class="drole">${esc(f.kind)}${f.head && f.head !== '—' ? ' · Head: ' + esc(f.head) : ''}</div>
    <div class="dtags">${f.members.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div></div></div>`;
  showDetail(head, b);
}

function openThread(t) {
  let b = '';
  b += fieldSec('Tension', t.tension);
  b += fieldSec('What’s Colliding', t.colliding);
  b += fieldSec('Forces in Play', t.forces);
  b += fieldSec('In Play — On the Table', t.onTable);
  b += fieldSec('Next Beat', t.nextBeat);
  b += fieldSec('Off the Table (DM)', t.offTable, 'dm');
  b += fieldSec('Trajectory', t.trajectory);
  b += fieldSec('Residue', t.residue);
  b += fieldSec('Open Questions', t.openQuestions);
  b += fieldSec('Movement Log', t.log);
  const head = `<div class="dhead"><div style="flex:1"><div class="eyebrow" style="margin-bottom:6px">Thread</div><h2>${esc(t.name)}</h2>${t.spine ? `<div class="drole">spine: ${esc(t.spine)}</div>` : ''}<div class="dtags"><span class="chip">${esc(t.state)}</span>${t.lastMoved ? `<span class="chip">last moved S${t.lastMoved}</span>` : ''}</div></div></div>`;
  showDetail(head, b);
}

function openLore(l) {
  let b = '';
  if (l.revealState) b += fieldSec('Reveal State', l.revealState);
  if (l.feeds && l.feeds.length) b += `<div class="sec"><div class="sh">Feeds Into</div><div class="md">${R(l.feeds.map(x => '- ' + x).join('\n'))}</div></div>`;
  b += `<div class="sec"><div class="sh">Detail</div><div class="md">${R(l.body)}</div></div>`;
  const head = `<div class="dhead"><div style="flex:1"><div class="eyebrow" style="margin-bottom:6px">Lore</div><h2>${esc(l.name)}</h2></div></div>`;
  showDetail(head, b);
}

function openPlayer(p) {
  let b = '';
  b += `<div class="thin-note">Player files are still the old prose format (not the schema-driven model yet) — shown here rendered as-is. Migrating players to the NPC-style schema would make this pull like the other cards.</div>`;
  b += `<div class="sec"><div class="sh">Lore</div><div class="md">${R(p.body)}</div></div>`;
  if (p.spotlight) b += `<div class="sec"><div class="sh">Spotlight Profile</div><div class="md">${R(p.spotlight)}</div></div>`;
  const head = `<div class="dhead">
    <div class="dpor ${p.img ? '' : 'noimg'}">${p.img ? `<img src="${p.img}">` : '◈'}</div>
    <div style="flex:1"><h2>${esc(p.name)}</h2><div class="drole">${esc(p.class || p.role)}${p.player ? ' · ' + esc(p.player) : ''}</div></div></div>`;
  showDetail(head, b);
}

function showDetail(head, body) {
  detailHtml.value = head + `<div class="dbody">${body}</div>`;
  detail.value = true;
  const d = document.querySelector('.dm-drawer'); if (d) d.scrollTop = 0;
}
function openById(kind, id) {
  if (kind === 'npc') { const n = vault.npcs.value.find(x => x.id === id); if (n) return openNpc(n); }
  if (kind === 'faction') { const f = vault.factions.value.find(x => x.id === id); if (f) return openFaction(f); }
  if (kind === 'thread') { const t = vault.threads.value.find(x => x.id === id); if (t) return openThread(t); }
  if (kind === 'lore') { const l = vault.lore.value.find(x => x.id === id); if (l) return openLore(l); }
  if (kind === 'player') { const p = vault.players.value.find(x => x.id === id); if (p) return openPlayer(p); }
}
function onDrawerClick(e) {
  const el = e.target.closest('.wl, .linknpc');
  if (!el) return;
  const kind = el.getAttribute('data-kind');
  const id = el.getAttribute('data-id');
  if (kind && id) { e.stopPropagation(); openById(kind, id); }
}

onMounted(() => { if (vault.configured.value) vault.loadAll(); });
</script>

<style scoped>
.dm-page {
  --dm-gold: #c9a24b; --dm-gold-bright: #e6c264; --dm-gold-deep: #8a6d2e;
  --dm-ink: #e8dcc6; --dm-ink-dim: #b3a488; --dm-ink-faint: #8a7c63;
  --dm-panel: #1b1611; --dm-panel2: #221b14; --dm-line: #3a2f22; --dm-line-soft: #2a2219;
  --dm-red: #c1503f; --dm-red-soft: #7a2f26; --dm-green: #6f8f4e; --dm-blue: #5a7d9a;
  --dm-hot: #e07b39; --dm-cool: #6a7f8a;
  --dm-serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --dm-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
  color: var(--dm-ink); font-family: var(--dm-serif);
}
.dm-shell { display: flex; min-height: calc(100vh - 64px); }
.dm-side { width: 210px; flex: 0 0 210px; border-right: 1px solid var(--dm-line);
  padding: 20px 0; position: sticky; top: 64px; height: calc(100vh - 64px); display: flex; flex-direction: column; }
.dm-brand { padding: 0 20px 16px; border-bottom: 1px solid var(--dm-line-soft); margin-bottom: 12px; }
.dm-brand-title { font-size: 20px; letter-spacing: .12em; color: var(--dm-gold-bright); text-transform: uppercase; }
.dm-brand-sub { font-family: var(--dm-sans); font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: var(--dm-ink-faint); margin-top: 4px; }
.dm-nav { padding: 0 10px; flex: 1; }
.dm-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 10px 12px; border-radius: 7px; font-family: var(--dm-sans); font-size: 13px;
  color: var(--dm-ink-dim); background: transparent; border: 1px solid transparent; cursor: pointer; margin: 2px 0; }
.dm-nav-item:hover { background: var(--dm-panel); color: var(--dm-ink); }
.dm-nav-item.active { background: linear-gradient(90deg, rgba(201,162,75,.16), rgba(201,162,75,.03)); color: var(--dm-gold-bright); border-color: var(--dm-line); }
.dm-nav-item .ic { width: 18px; text-align: center; }
.dm-side-foot { padding: 12px 20px 0; border-top: 1px solid var(--dm-line-soft); }
.dm-refresh { font-family: var(--dm-sans); font-size: 12px; color: var(--dm-ink-dim); background: var(--dm-panel);
  border: 1px solid var(--dm-line); border-radius: 6px; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.dm-refresh:hover:not(:disabled) { color: var(--dm-gold); border-color: var(--dm-gold-deep); }
.dm-refresh:disabled { opacity: .5; }

.dm-main { flex: 1; min-width: 0; padding: 30px 40px 80px; max-width: 1500px; }
.dm-head { margin-bottom: 22px; }
.dm-head h2 { font-size: 28px; color: var(--dm-gold-bright); }
.dm-head .lead { font-family: var(--dm-sans); font-size: 13px; color: var(--dm-ink-dim); margin-top: 6px; }
.eyebrow { font-family: var(--dm-sans); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--dm-gold); margin-bottom: 6px; }
.dm-loading, .dm-none, .dm-error { font-family: var(--dm-sans); color: var(--dm-ink-dim); padding: 40px 0; }
.dm-error p { margin: 8px 0 14px; color: var(--dm-red); }
.dm-notice { font-family: var(--dm-sans); font-size: 12px; color: var(--dm-ink-dim);
  background: rgba(90,125,154,.06); border: 1px solid rgba(90,125,154,.25); border-left: 3px solid var(--dm-blue);
  border-radius: 6px; padding: 11px 15px; margin-bottom: 22px; }
.dm-notice strong { color: var(--dm-blue); }

.grid { display: grid; gap: 16px; }
.g-players { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.g-fac { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.g-npc { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.g-lore { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }

.dm-card { background: linear-gradient(180deg, var(--dm-panel2), var(--dm-panel));
  border: 1px solid var(--dm-line); border-radius: 12px; overflow: hidden; cursor: pointer; transition: .16s; }
.dm-card:hover { border-color: var(--dm-gold-deep); transform: translateY(-2px); }
.dm-card.dead { border-color: var(--dm-red-soft); }
.clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.clamp3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

.pcard { display: flex; }
.pcard .por { width: 110px; flex: 0 0 110px; background: #0a0906; }
.pcard .por img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.pcard .por.noimg { display: flex; align-items: center; justify-content: center; color: var(--dm-ink-faint); font-size: 30px; }
.pcard .body { padding: 14px 15px; }
.pcard .name { font-size: 19px; color: var(--dm-gold-bright); }
.pcard .who { font-family: var(--dm-sans); font-size: 11px; color: var(--dm-ink-faint); margin-top: 3px; }
.pcard .cls { font-family: var(--dm-sans); font-size: 12px; color: var(--dm-ink-dim); margin-top: 8px; }

.fcard .top { display: flex; gap: 14px; padding: 16px 16px 12px; align-items: center; }
.fcard .crest { width: 56px; height: 56px; flex: 0 0 56px; border-radius: 9px; background: #0a0906; border: 1px solid var(--dm-line); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.fcard .crest img { width: 100%; height: 100%; object-fit: cover; }
.fcard .crest.noimg { color: var(--dm-ink-faint); font-size: 20px; }
.fcard .tt h3 { font-size: 19px; color: var(--dm-gold-bright); }
.fcard .kind { font-family: var(--dm-sans); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--dm-ink-faint); margin-top: 3px; }
.fcard .head { font-family: var(--dm-sans); font-size: 12px; color: var(--dm-ink-dim); margin-top: 4px; }
.fcard .status { padding: 0 16px 12px; font-size: 13px; color: var(--dm-ink-dim); }
.fcard .metarow { display: flex; gap: 8px; padding: 0 16px 16px; flex-wrap: wrap; }
.chip { font-family: var(--dm-sans); font-size: 10.5px; padding: 3px 9px; border-radius: 20px; background: var(--dm-panel); border: 1px solid var(--dm-line-soft); color: var(--dm-ink-dim); }

.dm-lane { margin-bottom: 26px; }
.lane-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 9px; border-bottom: 1px solid var(--dm-line); }
.lane-head h3 { font-size: 19px; color: var(--dm-gold-bright); }
.lane-head .count { font-family: var(--dm-sans); font-size: 11px; color: var(--dm-ink-faint); background: var(--dm-panel); padding: 2px 9px; border-radius: 20px; border: 1px solid var(--dm-line-soft); }
.lane-head .count.ph { color: var(--dm-red); }
.lane-head .desc { font-family: var(--dm-sans); font-size: 12px; color: var(--dm-ink-dim); margin-left: auto; }

.ncard .por { height: 150px; background: #0a0906; overflow: hidden; position: relative; }
.ncard .por img { width: 100%; height: 100%; object-fit: cover; object-position: center 22%; }
.ncard .por.noimg { display: flex; align-items: center; justify-content: center; color: var(--dm-ink-faint); font-size: 40px; }
.ncard .por .badge { position: absolute; bottom: 0; left: 0; right: 0; padding: 22px 12px 8px; background: linear-gradient(transparent, rgba(10,9,6,.92)); }
.ncard .por .badge h4 { font-size: 17px; color: var(--dm-ink); }
.ncard .por .badge .role { font-family: var(--dm-sans); font-size: 10.5px; color: var(--dm-gold); margin-top: 2px; }
.ncard .meta { padding: 10px 12px; display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.d-active { background: var(--dm-green); } .d-dead { background: var(--dm-red); } .d-dormant { background: var(--dm-cool); }
.ncard .fac { font-family: var(--dm-sans); font-size: 11px; color: var(--dm-ink-faint); }
.ncard .sit { padding: 0 12px 12px; font-size: 12.5px; color: var(--dm-ink-dim); }
.disp { font-family: var(--dm-sans); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; margin-left: auto; }
.disp.hostile { color: var(--dm-red); } .disp.friendly { color: var(--dm-green); } .disp.neutral, .disp.unknown { color: var(--dm-ink-faint); } .disp.wary { color: var(--dm-hot); } .disp.cosmic { color: var(--dm-gold); }

.tcard { background: linear-gradient(180deg, var(--dm-panel2), var(--dm-panel)); border: 1px solid var(--dm-line); border-radius: 11px; padding: 16px 17px; cursor: pointer; transition: .16s; position: relative; }
.tcard:hover { border-color: var(--dm-gold-deep); transform: translateY(-2px); }
.tcard.beat { border-style: dashed; cursor: default; }
.tcard.beat:hover { transform: none; }
.tcard h4 { font-size: 17px; color: var(--dm-ink); margin-bottom: 6px; }
.tcard.thread h4 { color: var(--dm-gold-bright); }
.tcard .tension { font-size: 13px; color: var(--dm-ink-dim); }
.tcard .tfoot { display: flex; gap: 8px; margin-top: 11px; align-items: center; flex-wrap: wrap; }
.state { font-family: var(--dm-sans); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: var(--dm-panel); border: 1px solid var(--dm-line-soft); color: var(--dm-ink-dim); }
.state.active { color: var(--dm-hot); border-color: rgba(224,123,57,.4); }
.pushtag { font-family: var(--dm-sans); font-size: 11px; color: var(--dm-ink-faint); }
.pushtag b { color: var(--dm-gold); }
.ph-badge { position: absolute; top: 12px; right: 12px; font-family: var(--dm-sans); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--dm-red); border: 1px solid var(--dm-red-soft); border-radius: 4px; padding: 2px 6px; }

.dm-empty { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 140px); padding: 40px; }
.dm-empty-card { max-width: 520px; background: linear-gradient(180deg, var(--dm-panel2), var(--dm-panel)); border: 1px solid var(--dm-line); border-radius: 14px; padding: 32px 34px; }
.dm-empty-title { font-size: 24px; color: var(--dm-gold-bright); margin-bottom: 14px; }
.dm-empty-card p { font-family: var(--dm-sans); font-size: 14px; color: var(--dm-ink-dim); line-height: 1.6; margin-bottom: 12px; }
.dm-empty-card code { background: var(--dm-panel); padding: 2px 6px; border-radius: 4px; color: var(--dm-gold); font-size: 12.5px; }
.dm-empty-note { font-size: 12.5px !important; color: var(--dm-ink-faint) !important; }
</style>

<style>
/* Detail drawer — not scoped, because the drawer body is injected via v-html */
.dm-scrim { position: fixed; inset: 0; background: rgba(6,5,3,.72); backdrop-filter: blur(3px); opacity: 0; pointer-events: none; transition: .2s; z-index: 3000; }
.dm-scrim.on { opacity: 1; pointer-events: auto; }
.dm-drawer { position: fixed; top: 0; right: 0; height: 100vh; width: min(760px, 94vw);
  background: linear-gradient(180deg, #15110d, #0e0c0a); border-left: 1px solid #8a6d2e;
  transform: translateX(100%); transition: transform .25s cubic-bezier(.4,0,.2,1); z-index: 3001; overflow-y: auto; box-shadow: -20px 0 60px rgba(0,0,0,.5); }
.dm-drawer.on { transform: translateX(0); }
.dm-drawer .dclose { position: absolute; top: 18px; right: 20px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #3a2f22; background: #1b1611; color: #b3a488; font-size: 18px; cursor: pointer; z-index: 2; }
.dm-drawer .dclose:hover { color: #e8dcc6; border-color: #8a6d2e; }
.dm-drawer .dhead { padding: 30px 34px 22px; border-bottom: 1px solid #3a2f22; display: flex; gap: 20px; font-family: 'Iowan Old Style', Palatino, Georgia, serif; }
.dm-drawer .dpor { width: 120px; height: 150px; flex: 0 0 120px; border-radius: 10px; overflow: hidden; background: #0a0906; border: 1px solid #3a2f22; display: flex; align-items: center; justify-content: center; color: #8a7c63; font-size: 44px; }
.dm-drawer .dpor img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.dm-drawer .dhead h2 { font-size: 27px; color: #e6c264; line-height: 1.1; }
.dm-drawer .drole { font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: #c9a24b; margin-top: 4px; }
.dm-drawer .dtags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.dm-drawer .dtags .chip, .dm-drawer .chip { font-family: 'Inter', system-ui, sans-serif; font-size: 10.5px; padding: 3px 9px; border-radius: 20px; background: #1b1611; border: 1px solid #2a2219; color: #b3a488; }
.dm-drawer .eyebrow { font-family: 'Inter', system-ui, sans-serif; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #c9a24b; }
.dm-drawer .dbody { padding: 22px 34px 60px; font-family: 'Iowan Old Style', Palatino, Georgia, serif; }
.dm-drawer .sec { margin-bottom: 20px; }
.dm-drawer .sec .sh { font-family: 'Inter', system-ui, sans-serif; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #c9a24b; margin-bottom: 8px; display: flex; align-items: center; gap: 9px; }
.dm-drawer .sec .sh::after { content: ""; flex: 1; height: 1px; background: #2a2219; }
.dm-drawer .sec.dm { background: rgba(90,125,154,.05); border: 1px solid rgba(90,125,154,.22); border-radius: 8px; padding: 14px 16px; }
.dm-drawer .sec.dm .sh { color: #5a7d9a; }
.dm-drawer .two { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

/* rendered-markdown block */
.dm-drawer .md { font-size: 14.5px; color: #b3a488; line-height: 1.62; }
.dm-drawer .md .md-p { margin: 0 0 10px; }
.dm-drawer .md .md-p:last-child { margin-bottom: 0; }
.dm-drawer .md .md-h { font-family: 'Inter', system-ui, sans-serif; color: #d8c98a; letter-spacing: .04em; margin: 14px 0 7px; }
.dm-drawer .md .md-h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .12em; color: #c9a24b; }
.dm-drawer .md .md-h3, .dm-drawer .md .md-h4 { font-size: 13.5px; text-transform: uppercase; letter-spacing: .08em; }
.dm-drawer .md .md-list { list-style: none; padding: 0; margin: 4px 0 10px; display: flex; flex-direction: column; gap: 6px; }
.dm-drawer .md .md-list li { padding-left: 16px; position: relative; }
.dm-drawer .md .md-list li::before { content: "\203A"; position: absolute; left: 0; color: #c9a24b; font-weight: 700; }
.dm-drawer .md strong { color: #e8dcc6; }
.dm-drawer .md em { color: #b7a8d0; font-style: italic; }
.dm-drawer .md code { background: #1b1611; border: 1px solid #2a2219; border-radius: 3px; padding: 1px 5px; font-size: 12.5px; color: #c9a24b; }
.dm-drawer .md .md-hr { border: none; border-top: 1px solid #2a2219; margin: 14px 0; }
.dm-drawer .md .md-quote { border-left: 2px solid #8a6d2e; padding-left: 12px; color: #8a7c63; font-style: italic; margin: 8px 0; }
.dm-drawer .md .md-table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 13.5px; }
.dm-drawer .md .md-table td, .dm-drawer .md .md-table th { border: 1px solid #2a2219; padding: 6px 10px; text-align: left; vertical-align: top; }
.dm-drawer .md .md-table th { color: #c9a24b; font-family: 'Inter', system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.dm-drawer .md .md-table td:first-child { color: #8a7c63; white-space: nowrap; width: 1%; font-family: 'Inter', system-ui, sans-serif; font-size: 12px; }
.dm-drawer .md .md-callout { border-radius: 7px; padding: 10px 13px; margin: 10px 0; border: 1px solid #2a2219; background: #1b1611; }
.dm-drawer .md .md-callout-t { font-family: 'Inter', system-ui, sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: #8a7c63; margin-bottom: 4px; }
.dm-drawer .md .md-callout-b { font-size: 13.5px; }
.dm-drawer .md .md-callout-warning { border-color: rgba(193,80,63,.35); background: rgba(193,80,63,.06); }
.dm-drawer .md .md-callout-warning .md-callout-t { color: #c1503f; }
.dm-drawer .md .md-callout-dm { border-color: rgba(90,125,154,.3); background: rgba(90,125,154,.06); }
.dm-drawer .md .md-callout-dm .md-callout-t { color: #5a7d9a; }
.dm-drawer .md .md-callout-note .md-callout-t { color: #c9a24b; }

/* wikilinks */
.dm-drawer .wl { color: #e0c877; border-bottom: 1px dotted rgba(224,200,119,.5); cursor: pointer; }
.dm-drawer .wl:hover { color: #f2dd97; border-bottom-color: #f2dd97; }
.dm-drawer .wl-dead { color: #9c8f74; border-bottom: 1px dotted rgba(156,143,116,.35); cursor: default; }
.dm-drawer .wl-dead:hover { color: #9c8f74; }

.dm-drawer .linknpc { display: inline-flex; align-items: center; gap: 7px; background: #1b1611; border: 1px solid #2a2219; border-radius: 20px; padding: 4px 12px 4px 5px; margin: 0 6px 6px 0; font-family: 'Inter', system-ui, sans-serif; font-size: 12.5px; color: #b3a488; cursor: pointer; }
.dm-drawer .linknpc:hover { border-color: #8a6d2e; color: #e8dcc6; }
.dm-drawer .linknpc .av { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; object-position: center top; background: #0a0906; }
.dm-drawer .linknpc .av.noimg { display: flex; align-items: center; justify-content: center; font-size: 11px; color: #8a7c63; }
.dm-drawer .thin-note { font-family: 'Inter', system-ui, sans-serif; font-size: 12px; color: #8a7c63; font-style: italic; background: #1b1611; border-radius: 6px; padding: 9px 13px; border: 1px dashed #3a2f22; margin-bottom: 16px; }
@media (max-width: 760px) {
  .dm-drawer .dhead { flex-direction: column; }
  .dm-drawer .two { grid-template-columns: 1fr; }
}
</style>
