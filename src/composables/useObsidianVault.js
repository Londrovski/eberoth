// useObsidianVault — reads the Eberoth Obsidian vault live via the
// Local REST API plugin (https://github.com/coddingtonbear/obsidian-local-rest-api).
//
// This powers the DM view ONLY. It runs entirely in the DM's browser and
// fetches from the DM's own machine (http://127.0.0.1:27123 by default),
// so no vault content ever touches a server. Because it reads localhost,
// it only works on the machine running Obsidian with the plugin enabled —
// desktop-only by design.
//
// Config (baseUrl + apiKey) lives in the app-settings store under the
// 'obsidian_api' key (DM-write in Supabase), set via the DM Tools menu.
//
// Gotchas handled here:
//  - The plugin must allow the site's origin via CORS, or the browser blocks
//    the fetch. We surface a clear error rather than failing silently.
//  - An https page (eberoth.pages.dev) calling http://localhost is a
//    mixed-content block in most browsers. Running the app locally over http
//    (or allow-listing the origin) avoids it. We detect and message this too.

import { ref, computed } from 'vue';
import { useAppSettingsStore } from 'src/stores/app-settings';

// Vault folders (absolute paths inside the vault) for each content type.
const FOLDERS = {
  npc:     '2. Content/2. NPCs',
  faction: '2. Content/3. Factions',
  lore:    '2. Content/4. Lore',
  thread:  '2. Content/5. Threads',
  player:  '2. Content/6. Players'
};

// ---- tiny YAML frontmatter parser -------------------------------------
// Handles the subset the Eberoth cards use: scalars, quoted strings,
// inline [a, b] arrays, block "|" scalars, and simple "- item" lists.
// Not a general YAML engine — deliberately small and predictable.
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

    // Block scalar: "key: |" — gather subsequent indented lines.
    if (rest.trim() === '|' || rest.trim() === '|-' || rest.trim() === '>') {
      const block = [];
      i++;
      // Determine indent from the first non-empty following line.
      let indent = null;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') { block.push(''); i++; continue; }
        const lead = l.match(/^(\s+)/);
        const thisIndent = lead ? lead[1].length : 0;
        if (indent === null) {
          if (thisIndent === 0) break; // no indented block
          indent = thisIndent;
        }
        if (thisIndent < indent) break;
        block.push(l.slice(indent));
        i++;
      }
      data[key] = block.join('\n').trim();
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

    // Plain scalar.
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

// Turn "[[House Halvorn]]" or "[[Orthon Halvorn|Orthon]]" into a clean name.
function delink(s) {
  if (!s) return s;
  return String(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => (b || a).trim());
}
function delinkList(arr) {
  if (!arr) return [];
  return (Array.isArray(arr) ? arr : [arr]).map(delink).filter(Boolean);
}

// Parse the loose "- **Name** — *(type)* text" relation blocks factions/threads
// use inside a block scalar into [{name,type,text}] rows. Falls back to a plain
// paragraph if it doesn't match the pattern.
function parseRelationBlock(block) {
  if (!block) return { rows: [], text: '' };
  const lines = String(block).split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  let leftover = [];
  for (const l of lines) {
    const m = l.match(/^-\s+\*\*(.+?)\*\*\s*(?:—|-)?\s*(?:\*\((.+?)\)\*)?\s*(.*)$/);
    if (m) {
      rows.push({ name: delink(m[1]), type: m[2] || '', text: delink(m[3] || '') });
    } else if (l.startsWith('-')) {
      rows.push({ name: '', type: '', text: delink(l.replace(/^-\s*/, '')) });
    } else {
      leftover.push(delink(l));
    }
  }
  return { rows, text: leftover.join(' ') };
}

// Split a block scalar into bullet lines (for logs, open questions, etc).
function toLines(block) {
  if (!block) return [];
  if (Array.isArray(block)) return block.map(delink);
  return String(block).split('\n')
    .map(l => l.replace(/^\s*-\s*/, '').trim())
    .map(delink)
    .filter(Boolean);
}

// ---- image base (reuse the compendium's GitHub image host) ------------
const IMAGE_BASE = 'https://raw.githubusercontent.com/Londrovski/eberoth/main/images/';
function imageFromName(name) {
  // Vault sigil field is a full path "2. Content/1. Images/House Halvorn.png";
  // the compendium hosts bare filenames. Take the basename.
  if (!name) return null;
  const base = String(name).split('/').pop();
  return IMAGE_BASE + encodeURIComponent(base);
}

export function useObsidianVault() {
  const app = useAppSettingsStore();
  const loading = ref(false);
  const error = ref(null);
  const raw = ref({ npcs: [], factions: [], lore: [], threads: [], players: [] });

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
    // Ask for raw markdown, not the JSON wrapper.
    const url = `${base()}/vault/${encodeURI(path)}`;
    const res = await fetch(url, { headers: { ...headers(), Accept: 'text/markdown' } });
    if (!res.ok) throw new Error(`Read ${path} → ${res.status}`);
    return await res.text();
  }

  async function loadType(kind) {
    const folder = FOLDERS[kind];
    const files = await apiListDir(folder);
    const out = [];
    // Sequential-ish with a small concurrency cap to be gentle on the plugin.
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
    // Players are folders-per-PC; grab the main <Name>.md + optional Spotlight.
    let subdirs = [];
    try {
      const url = `${base()}/vault/${encodeURI(FOLDERS.player)}/`;
      const res = await fetch(url, { headers: headers() });
      if (res.ok) {
        const json = await res.json();
        subdirs = (json.files || []).filter(f => f.endsWith('/')).map(f => f.replace(/\/$/, ''));
      }
    } catch (e) { /* players are optional / thin */ }
    const players = [];
    for (const dir of subdirs) {
      try {
        const files = await apiListDir(`${FOLDERS.player}/${dir}`);
        const mainFile = files.find(f => f.replace('.md', '') === dir) || files[0];
        const spotFile = files.find(f => /spotlight/i.test(f));
        const mainMd = mainFile ? await apiReadFile(`${FOLDERS.player}/${dir}/${mainFile}`) : '';
        const spotMd = spotFile ? await apiReadFile(`${FOLDERS.player}/${dir}/${spotFile}`) : '';
        players.push({ name: dir, main: parseFrontmatter(mainMd), spotlight: parseFrontmatter(spotMd) });
      } catch (e) { /* skip a broken PC folder */ }
    }
    return players;
  }

  async function loadAll() {
    if (!configured.value) {
      error.value = 'Obsidian API not configured — set the URL and key in DM Tools.';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const [npcs, factions, lore, threads, players] = await Promise.all([
        loadType('npc'), loadType('faction'), loadType('lore'), loadType('thread'), loadPlayers()
      ]);
      raw.value = { npcs, factions, lore, threads, players };
    } catch (e) {
      const msg = String(e.message || e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
        error.value = 'Could not reach Obsidian. Check Obsidian is open, the Local REST API plugin is running, and (if on the https site) that the browser allows localhost — see DM Tools.';
      } else {
        error.value = msg;
      }
    } finally {
      loading.value = false;
    }
  }

  // ---- shapers: raw parsed files → the view model the DM page renders ----
  const npcs = computed(() => raw.value.npcs.map(shapeNpc).filter(Boolean));
  const factions = computed(() => {
    const list = raw.value.factions.map(shapeFaction).filter(Boolean);
    // attach connected NPCs by faction name
    const byFac = {};
    for (const n of npcs.value) { (byFac[n.faction] = byFac[n.faction] || []).push(n); }
    for (const f of list) { f.npcs = byFac[f.name] || []; }
    return list;
  });
  const lore = computed(() => raw.value.lore.map(shapeLore).filter(Boolean));
  const threads = computed(() => raw.value.threads.map(shapeThread).filter(Boolean));
  const players = computed(() => raw.value.players.map(shapePlayer).filter(Boolean));

  function shapeNpc(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, faction: delink(d.faction) || '—',
      role: d.role || '', status: d.status || 'active', disposition: d.disposition || 'unknown',
      lastSession: d.last_session ?? null, knowsParty: d.knows_party || '',
      currentSituation: d.current_situation || '', img: imageFromName(d.name + '.png'),
      tags: d.tags || [],
      context: d.context, staging: d.staging, desires: d.desires, actions: d.actions,
      characterKnowledge: d.character_knowledge, playerKnowledge: d.player_knowledge,
      dmSecrets: d.dm_secrets, forwardProjection: d.forward_projection,
      openQuestions: toLines(d.open_questions), threads: delinkList(d.linked_threads),
      log: toLines(d.log),
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
      relations: parseRelationBlock(d.relations).rows,
      playerConnections: d.player_connections || '',
      threads: parseRelationBlock(d.threads).rows.map(r => r.name || r.text),
      openQuestions: toLines(d.open_questions), log: toLines(d.log),
      npcs: []
    };
  }

  function shapeLore(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, revealState: d.reveal_state || '',
      feeds: delinkList(d.feeds),
      // body carries Truth / What's Known / Open Questions as markdown sections
      body: row.body || ''
    };
  }

  function shapeThread(row) {
    const d = row.data || {};
    if (!d.name) return null;
    return {
      id: slug(d.name), name: d.name, state: d.state || 'active',
      lastMoved: d.last_moved ?? null, spine: delink(d.spine) || '',
      tension: d.tension || '', colliding: d.colliding || '',
      forces: parseRelationBlock(d.forces).rows,
      onTable: d.on_table || '', offTable: d.off_table || '',
      nextBeat: d.next_beat || '', trajectory: d.trajectory || '',
      openQuestions: toLines(d.open_questions), log: toLines(d.log)
    };
  }

  function shapePlayer(p) {
    const d = p.main?.data || {};
    const name = d.name || p.name;
    return {
      id: slug(name), name,
      img: imageFromName(name + '.png'),
      // Player files are older prose format; expose frontmatter if present
      // plus the raw body sections for display.
      role: d.role || '', class: d.class || '', player: d.player || '',
      body: p.main?.body || '',
      spotlight: p.spotlight?.body || '',
      thin: !(p.main?.body)
    };
  }

  return {
    loading, error, configured,
    loadAll,
    npcs, factions, lore, threads, players,
    // expose helpers the page may reuse
    _util: { delink, toLines, imageFromName }
  };
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
