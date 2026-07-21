// useObsidianVault — reads the Eberoth Obsidian vault live via the
// Local REST API plugin (https://github.com/coddingtonbear/obsidian-local-rest-api).
//
// This powers the DM view ONLY. It runs entirely in the DM's browser and
// fetches from the DM's own machine (https://127.0.0.1:27124 by default),
// so no vault content ever touches a server. Because it reads localhost,
// it only works on the machine running Obsidian with the plugin enabled —
// desktop-only by design.
//
// Config (baseUrl + apiKey) lives in the app-settings store under the
// 'obsidian_api' key (DM-write in Supabase), set via the DM Tools menu.

import { ref, computed } from 'vue';
import { useAppSettingsStore } from 'src/stores/app-settings';

// Vault folders (absolute paths inside the vault) for each content type.
const FOLDERS = {
  npc:     '2. Content/2. NPCs',
  faction: '2. Content/3. Factions',
  lore:    '2. Content/4. Lore',
  thread:  '2. Content/5. Threads',
  player:  '2. Content/6. Players',
  overview: '3. Overviews'
};

// Session folders (transcripts deliberately excluded).
const SESSION_ROOT = '4. Sessions';
const SESSION_SUBS = ['Main Story', 'Flashbacks'];

// ---- tiny YAML frontmatter parser -------------------------------------
// Handles the subset the Eberoth cards use: scalars, quoted strings,
// inline [a, b] arrays, block "|" scalars, and simple "- item" lists.
function parseFrontmatter(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text.trim() };
  const yaml = m[1];
  const body = (m[2] || '').trim();
  const data = {};
  const lines = yaml.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const kv = line.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    let rest = kv[2];

    // Block scalar: "key: |" — gather subsequent indented lines (keeps blank lines).
    if (rest.trim() === '|' || rest.trim() === '|-' || rest.trim() === '>') {
      const block = [];
      i++;
      let indent = null;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') { block.push(''); i++; continue; }
        const lead = l.match(/^(\s+)/);
        const thisIndent = lead ? lead[1].length : 0;
        if (indent === null) {
          if (thisIndent === 0) break;
          indent = thisIndent;
        }
        if (thisIndent < indent) break;
        block.push(l.slice(indent));
        i++;
      }
      data[key] = block.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      continue;
    }

    // Inline array: key: [a, b, c]
    if (rest.trim().startsWith('[')) {
      data[key] = rest.trim()
        .replace(/^\[/, '').replace(/\]$/, '')
        .split(',')
        .map(s => stripQuotes(s.trim()))
        .filter(Boolean);
      i++;
      continue;
    }

    // Multi-line "- item" list following "key:" with empty value.
    if (rest.trim() === '') {
      const arr = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        arr.push(stripQuotes(lines[j].replace(/^\s*-\s+/, '').trim()));
        j++;
      }
      if (arr.length) { data[key] = arr; i = j; continue; }
      data[key] = '';
      i++;
      continue;
    }

    data[key] = stripQuotes(rest.trim());
    i++;
  }
  return { data, body };
}

function stripQuotes(s) {
  if (!s) return s;
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// Turn "[[House Halvorn]]" or "[[Orthon Halvorn|Orthon]]" into a clean display name.
function delink(s) {
  if (!s) return s;
  return String(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b || a).trim());
}
function delinkList(arr) {
  if (!arr) return [];
  return (Array.isArray(arr) ? arr : [arr]).map(delink).filter(Boolean);
}
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---- image base (reuse the compendium's GitHub image host) ------------
const IMAGE_BASE = 'https://raw.githubusercontent.com/Londrovski/eberoth/main/images/';
function imageFromName(name) {
  if (!name) return null;
  const base = String(name).split('/').pop();
  return IMAGE_BASE + encodeURIComponent(base);
}

export function useObsidianVault() {
  const app = useAppSettingsStore();
  const loading = ref(false);
  const error = ref(null);
  const raw = ref({ npcs: [], factions: [], lore: [], threads: [], players: [], overviews: [], sessions: [] });

  const configured = computed(() =>
    !!(app.obsidianApi?.baseUrl && app.obsidianApi?.apiKey));

  function headers() {
    return { Authorization: `Bearer ${app.obsidianApi.apiKey}`, Accept: 'application/json' };
  }
  function base() {
    return String(app.obsidianApi.baseUrl || '').replace(/\/$/, '');
  }

  async function apiListDir(folder) {
    const url = `${base()}/vault/${encodeURI(folder)}/`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`List ${folder} → ${res.status}`);
    const json = await res.json();
    return (json.files || []).filter(f => f.endsWith('.md'));
  }

  async function apiReadFile(path) {
    const url = `${base()}/vault/${encodeURI(path)}`;
    const res = await fetch(url, { headers: { ...headers(), Accept: 'text/markdown' } });
    if (!res.ok) throw new Error(`Read ${path} → ${res.status}`);
    return await res.text();
  }

  async function loadType(kind) {
    const folder = FOLDERS[kind];
    const files = await apiListDir(folder);
    const out = [];
    const CHUNK = 6;
    for (let i = 0; i < files.length; i += CHUNK) {
      const slice = files.slice(i, i + CHUNK);
      const parts = await Promise.all(slice.map(async (f) => {
        try {
          const md = await apiReadFile(`${folder}/${f}`);
          return { file: f, ...parseFrontmatter(md) };
        } catch (e) {
          return { file: f, data: {}, body: '', _err: String(e.message || e) };
        }
      }));
      out.push(...parts);
    }
    return out;
  }

  async function loadPlayers() {
    let subdirs = [];
    try {
      const url = `${base()}/vault/${encodeURI(FOLDERS.player)}/`;
      const res = await fetch(url, { headers: headers() });
      if (res.ok) {
        const json = await res.json();
        subdirs = (json.files || []).filter(f => f.endsWith('/')).map(f => f.replace(/\/$/, ''));
      }
    } catch (e) { /* players optional */ }
    const players = [];
    for (const dir of subdirs) {
      try {
        const files = await apiListDir(`${FOLDERS.player}/${dir}`);
        // main file = <dir>.md; skip spotlight for the main; grab spotlight separately
        const mainFile = files.find(f => f.replace('.md', '') === dir)
          || files.find(f => !/spotlight/i.test(f)) || files[0];
        const spotFile = files.find(f => /spotlight/i.test(f));
        const mainMd = mainFile ? await apiReadFile(`${FOLDERS.player}/${dir}/${mainFile}`) : '';
        const spotMd = spotFile ? await apiReadFile(`${FOLDERS.player}/${dir}/${spotFile}`) : '';
        players.push({ name: dir, main: parseFrontmatter(mainMd), spotlight: parseFrontmatter(spotMd) });
      } catch (e) { /* skip broken PC folder */ }
    }
    return players;
  }

  // Sessions: root loose files + Main Story + Flashbacks (transcripts excluded).
  async function loadSessions() {
    const out = [];
    const dirs = [SESSION_ROOT, ...SESSION_SUBS.map(s => `${SESSION_ROOT}/${s}`)];
    for (const dir of dirs) {
      let files = [];
      try { files = await apiListDir(dir); } catch (e) { continue; }
      for (const f of files) {
        try {
          const md = await apiReadFile(`${dir}/${f}`);
          out.push({ file: f, folder: dir, ...parseFrontmatter(md) });
        } catch (e) { /* skip */ }
      }
    }
    return out;
  }

  async function loadAll() {
    if (!configured.value) {
      error.value = 'Obsidian API not configured — set the URL and key in DM Tools.';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const [npcs, factions, lore, threads, players, overviews, sessions] = await Promise.all([
        loadType('npc'), loadType('faction'), loadType('lore'), loadType('thread'), loadPlayers(),
        loadType('overview'), loadSessions()
      ]);
      raw.value = { npcs, factions, lore, threads, players, overviews, sessions };
    } catch (e) {
      const msg = String(e.message || e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
        error.value = 'Could not reach Obsidian. Check Obsidian is open, the Local REST API plugin is running, and that the browser trusts the cert / allows the origin — see DM Tools.';
      } else if (/→ 401/.test(msg)) {
        error.value = 'Obsidian rejected the API key (401). Re-copy the key from the Local REST API plugin settings into DM Tools.';
      } else {
        error.value = msg;
      }
    } finally {
      loading.value = false;
    }
  }

  // ---- view models: keep raw block text; render happens in the renderer ----
  const npcs = computed(() => raw.value.npcs.map(shapeNpc).filter(Boolean));
  const factions = computed(() => {
    const list = raw.value.factions.map(shapeFaction).filter(Boolean);
    const byFac = {};
    for (const n of npcs.value) { (byFac[n.faction] = byFac[n.faction] || []).push(n); }
    for (const f of list) {
      // connected NPCs = members resolved to NPC cards, plus any NPC whose faction matches
      const memberIds = new Set(f.members.map(m => slug(m)));
      const byMember = npcs.value.filter(n => memberIds.has(n.id));
      const byFaction = byFac[f.name] || [];
      const seen = new Set();
      f.npcs = [...byMember, ...byFaction].filter(n => {
        if (seen.has(n.id)) return false;
        seen.add(n.id); return true;
      });
    }
    return list;
  });
  const lore = computed(() => raw.value.lore.map(shapeLore).filter(Boolean));
  const threads = computed(() => raw.value.threads.map(shapeThread).filter(Boolean));
  const players = computed(() => raw.value.players.map(shapePlayer).filter(Boolean));
  const overviews = computed(() => raw.value.overviews.map(shapeOverview).filter(Boolean));
  const sessions = computed(() => raw.value.sessions.map(shapeSession).filter(Boolean)
    .sort((a, b) => b.sort - a.sort));

  // ---- global entity index for wikilink resolution ----
  // maps a normalised name (and aliases) -> { kind, id }
  const index = computed(() => {
    const idx = {};
    const add = (name, kind, id) => { if (name) idx[normKey(name)] = { kind, id }; };
    for (const n of npcs.value) { add(n.name, 'npc', n.id); (n.aliases || []).forEach(a => add(a, 'npc', n.id)); }
    for (const f of factions.value) add(f.name, 'faction', f.id);
    for (const t of threads.value) add(t.name, 'thread', t.id);
    for (const l of lore.value) add(l.name, 'lore', l.id);
    for (const p of players.value) { add(p.name, 'player', p.id); if (p.trueName) add(p.trueName, 'player', p.id); }
    return idx;
  });

  function resolveLink(name) {
    return index.value[normKey(name)] || null;
  }

  function shapeNpc(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, faction: delink(d.faction) || '—',
      aliases: Array.isArray(d.aliases) ? d.aliases : (d.aliases ? [d.aliases] : []),
      role: d.role || '', status: d.status || 'active', disposition: d.disposition || 'unknown',
      lastSession: d.last_session ?? null, knowsParty: d.knows_party || '',
      currentSituation: d.current_situation || '', img: imageFromName(d.name + '.png'),
      tags: d.tags || [],
      context: d.context, staging: d.staging, desires: d.desires, actions: d.actions,
      characterKnowledge: d.character_knowledge, playerKnowledge: d.player_knowledge,
      dmSecrets: d.dm_secrets, forwardProjection: d.forward_projection,
      openQuestions: d.open_questions, linkedThreads: delinkList(d.linked_threads),
      log: d.log,
      thin: !d.desires && !d.dm_secrets
    };
  }

  function shapeFaction(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, kind: d.kind || 'faction',
      sigil: imageFromName(d.sigil), head: delink(d.head) || '—',
      members: delinkList(d.key_members),
      status: d.status || '', alignment: d.alignment || '',
      strengths: d.strengths || '', weaknesses: d.weaknesses || '',
      territory: d.territory || '', goalsShort: d.goals_short || '', goalsLong: d.goals_long || '',
      relations: d.relations || '', playerConnections: d.player_connections || '',
      threads: d.threads || '', openQuestions: d.open_questions || '', log: d.log || '',
      npcs: []
    };
  }

  function shapeLore(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, revealState: d.reveal_state || '',
      feeds: d.feeds || [], body: row.body || ''
    };
  }

  function shapeThread(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, state: d.state || 'active',
      lastMoved: d.last_moved ?? null, spine: delink(d.spine) || '',
      tension: d.tension || '', colliding: d.colliding || '',
      forces: d.forces || '',
      onTable: d.on_table || '', offTable: d.off_table || '',
      nextBeat: d.next_beat || '', trajectory: d.trajectory || '',
      residue: d.residue || '',
      openQuestions: d.open_questions || '', log: d.log || ''
    };
  }

  function shapePlayer(p) {
    const d = p.main?.data || {};
    const name = d.name || p.name;
    return {
      id: slug(name), name, trueName: d.true_name || '',
      img: imageFromName(name + '.png'),
      role: d.role || '', class: d.class || '', player: d.player || '',
      body: p.main?.body || '',
      spotlight: p.spotlight?.body || '',
      thin: !(p.main?.body)
    };
  }

  function shapeOverview(row) {
    const name = String(row.file || '').replace(/\.md$/, '');
    if (!name) return null;
    const body = row.body || '';
    // Is this page essentially just Dataview queries (no real prose)?
    const prose = body.replace(/```[\s\S]*?```/g, '').replace(/[#>*|_\-\s]/g, '');
    return {
      id: slug(name), name, body,
      queryOnly: prose.length < 60
    };
  }

  function shapeSession(row) {
    const name = String(row.file || '').replace(/\.md$/, '');
    if (!name) return null;
    const body = row.body || '';
    // Title/number: "Session 7 - The Hearing" / "Session 0.1 - Azrael Backstory" / "Session Flashback - ..."
    const num = name.match(/session\s+([0-9]+(?:\.[0-9]+)?)/i);
    const sort = num ? parseFloat(num[1]) : (/flashback/i.test(name) ? -1 : (/one-shot/i.test(name) ? -0.5 : 0));
    // Pull date + one-liner from the leading > [!info] callout if present.
    let date = '', oneLine = '';
    const dm = body.match(/·\s*(\d{4}-\d{2}-\d{2})/);
    if (dm) date = dm[1];
    const ol = body.match(/\*\*One line:\*\*\s*([^\n]+)/i);
    if (ol) oneLine = ol[1].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b || a)).trim();
    const kind = /flashback/i.test(name) ? 'Flashback' : (/one-shot/i.test(name) ? 'One-shot' : (/0\./.test(name) ? 'Backstory' : 'Main'));
    return { id: slug(name), name, body, sort, date, oneLine, kind };
  }

  return {
    loading, error, configured,
    loadAll,
    npcs, factions, lore, threads, players, overviews, sessions,
    index, resolveLink
  };
}

function normKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
