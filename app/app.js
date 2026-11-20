// Leonida Trophy Guide: a checklist of the 55 GTA VI trophies with a tracker that saves
// progress in localStorage, exports and imports it, filters by kind and grade, and hides
// story spoilers until a trophy is earned. It loads only its own data/trophies.json.
const EARNED_KEY = 'leonida-trophy-guide-v1';
const SPOILER_KEY = 'leonida-trophy-guide-spoiler';
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('grade');
const spoilerEl = document.getElementById('spoiler');
const earnedOnlyEl = document.getElementById('showEarnedOnly');
const listNoteEl = document.getElementById('listNote');
const emptyNoteEl = document.getElementById('emptyNote');
const importNoteEl = document.getElementById('importNote');

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const byName = new Map(trophies.map((t) => [t.name, t]));

let earned = new Set(readEarned());
let kindFilter = 'all';
let openDetails = new Set();

function readEarned() {
  try {
    const raw = JSON.parse(localStorage.getItem(EARNED_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((n) => byName.has(n)) : [];
  } catch {
    return [];
  }
}

function saveProgress() {
  localStorage.setItem(EARNED_KEY, JSON.stringify([...earned].sort()));
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function kindLabel(kind) {
  return { story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities', online: 'Online' }[kind] ?? kind;
}

function isSpoilerHidden(trophy) {
  return spoilerEl.checked && trophy.kind === 'story' && !earned.has(trophy.name);
}

function trophyMatches(trophy) {
  if (kindFilter === 'missable' && !trophy.missable) return false;
  if (kindFilter === 'online') return false;
  if (kindFilter !== 'all' && kindFilter !== 'missable' && trophy.kind !== kindFilter) return false;
  if (gradeEl.value !== 'all' && trophy.grade !== gradeEl.value) return false;
  if (earnedOnlyEl.checked && !earned.has(trophy.name)) return false;
  const q = searchEl.value.trim().toLowerCase();
  if (q) {
    const hay = [trophy.name, trophy.description, trophy.guide, ...(trophy.steps ?? [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function buildSourcesList(trophy) {
  const ul = document.createElement('ul');
  ul.className = 'sources';
  for (const s of trophy.sources ?? []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = s.name;
    a.target = '_blank';
    a.rel = 'noopener';
    li.append(a);
    ul.append(li);
  }
  return ul;
}

function buildTrophyDetail(trophy) {
  const detail = document.createElement('div');
  detail.className = 'trophy-detail';
  if (trophy.target) {
    const target = document.createElement('p');
    target.className = 'target';
    target.innerHTML = '';
    target.append('Target: ');
    const b = document.createElement('b');
    b.textContent = trophy.target;
    target.append(b);
    detail.append(target);
  }
  const guide = document.createElement('p');
  guide.textContent = trophy.guide;
  detail.append(guide);
  if (trophy.steps?.length) {
    const ol = document.createElement('ol');
    for (const step of trophy.steps) {
      const li = document.createElement('li');
      li.textContent = step;
      ol.append(li);
    }
    detail.append(ol);
  }
  detail.append(buildSourcesList(trophy));
  return detail;
}

function buildTrophyItem(trophy) {
  const li = document.createElement('li');
  li.className = 'trophy' + (earned.has(trophy.name) ? ' earned' : '');
  const hidden = isSpoilerHidden(trophy);

  const head = document.createElement('div');
  head.className = 'trophy-head';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophy.name);
  box.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) earned.add(trophy.name);
    else earned.delete(trophy.name);
    saveProgress();
    renderChecklist();
    renderProgress();
  });
  head.append(box);

  const main = document.createElement('div');
  main.className = 'trophy-main';
  const name = document.createElement('div');
  name.className = 'trophy-name';
  name.textContent = hidden ? 'Hidden story trophy' : trophy.name;
  main.append(name);
  const desc = document.createElement('div');
  desc.className = 'trophy-desc';
  desc.textContent = hidden ? 'Hidden until earned — tick it off to reveal its name and description.' : trophy.description;
  main.append(desc);
  const meta = document.createElement('div');
  meta.className = 'trophy-meta';
  const gradeBadge = document.createElement('span');
  gradeBadge.className = `badge ${trophy.grade}`;
  gradeBadge.textContent = gradeLabel(trophy.grade);
  meta.append(gradeBadge);
  const kindBadge = document.createElement('span');
  kindBadge.className = 'badge kind';
  kindBadge.textContent = kindLabel(trophy.kind);
  meta.append(kindBadge);
  if (trophy.hidden) {
    const b = document.createElement('span');
    b.className = 'badge hidden';
    b.textContent = 'Hidden on PSN';
    meta.append(b);
  }
  if (trophy.missable) {
    const b = document.createElement('span');
    b.className = 'badge missable';
    b.textContent = 'Possibly missable';
    meta.append(b);
  }
  if (trophy.unconfirmed) {
    const b = document.createElement('span');
    b.className = 'badge unconfirmed';
    b.textContent = 'Reported, unconfirmed';
    meta.append(b);
  }
  const stageBadge = document.createElement('span');
  stageBadge.className = 'badge stage';
  stageBadge.textContent = `Roadmap stage ${trophy.stage}`;
  meta.append(stageBadge);
  main.append(meta);
  head.append(main);

  if (!hidden) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'guide-toggle';
    const open = openDetails.has(trophy.name);
    toggle.textContent = open ? 'Hide guide' : 'Guide';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (openDetails.has(trophy.name)) openDetails.delete(trophy.name);
      else openDetails.add(trophy.name);
      renderChecklist();
    });
    head.append(toggle);
  }
  head.addEventListener('click', (event) => {
    if (event.target === box || hidden) return;
    if (openDetails.has(trophy.name)) openDetails.delete(trophy.name);
    else openDetails.add(trophy.name);
    renderChecklist();
  });
  li.append(head);
  if (!hidden && openDetails.has(trophy.name)) li.append(buildTrophyDetail(trophy));
  return li;
}

function renderChecklist() {
  listEl.replaceChildren();
  const shown = trophies.filter(trophyMatches);
  for (const trophy of shown) listEl.append(buildTrophyItem(trophy));
  emptyNoteEl.hidden = shown.length > 0;
  if (kindFilter === 'online') {
    emptyNoteEl.hidden = false;
    emptyNoteEl.textContent = 'No online trophies — all 55 trophies are earned offline in single-player. Nothing to track here.';
  } else {
    emptyNoteEl.textContent = 'No trophies match these filters.';
  }
  listNoteEl.textContent = `Showing ${shown.length} of ${trophies.length} trophies. Click a trophy (or its Guide button) to open its guide and sources.`;
}

function renderProgress() {
  const total = trophies.length;
  const done = earned.size;
  document.getElementById('progressText').textContent = `${done} of ${total} earned`;
  document.getElementById('progressPct').textContent = `${Math.round((done / total) * 100)}%`;
  document.getElementById('progressBar').style.width = `${(done / total) * 100}%`;
  const counts = document.getElementById('gradeCounts');
  counts.replaceChildren();
  for (const grade of ['platinum', 'gold', 'silver', 'bronze']) {
    const ofGrade = trophies.filter((t) => t.grade === grade);
    const got = ofGrade.filter((t) => earned.has(t.name)).length;
    const span = document.createElement('span');
    span.append(`${gradeLabel(grade)} `);
    const b = document.createElement('b');
    b.textContent = `${got}/${ofGrade.length}`;
    span.append(b);
    counts.append(span);
  }
  const kinds = document.getElementById('kindFilters');
  for (const button of kinds.querySelectorAll('button')) {
    const kind = button.dataset.kind;
    const count = kind === 'all' ? total
      : kind === 'missable' ? trophies.filter((t) => t.missable).length
      : kind === 'online' ? 0
      : trophies.filter((t) => t.kind === kind).length;
    button.textContent = `${kindLabel(kind) === 'All' ? 'All' : kindLabel(kind)} ${kind === 'all' ? total : count}`;
    if (kind === 'all') button.textContent = `All ${total}`;
  }
}

function exportProgress() {
  const payload = {
    game: 'Grand Theft Auto VI',
    guide: 'Leonida Trophy Guide',
    exported_at: new Date().toISOString(),
    earned: [...earned].sort(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgress(file) {
  importNoteEl.textContent = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const names = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(names)) throw new Error('expected a list of trophy names');
    const known = names.filter((n) => byName.has(n));
    earned = new Set(known);
    saveProgress();
    renderChecklist();
    renderProgress();
    importNoteEl.textContent = `Imported ${known.length} earned trophies${names.length - known.length ? ` (${names.length - known.length} unknown names ignored)` : ''}.`;
  } catch (error) {
    importNoteEl.textContent = `Import failed: ${error.message}. The file must be the JSON this guide exports (a list of trophy names, or an object with an "earned" list).`;
  }
}

function resetProgress() {
  if (!earned.size) return;
  if (!window.confirm(`Reset progress? This clears all ${earned.size} earned trophies in this browser.`)) return;
  earned = new Set();
  openDetails = new Set();
  saveProgress();
  renderChecklist();
  renderProgress();
}

function switchTab(which) {
  const checklist = which === 'checklist';
  document.getElementById('viewChecklist').hidden = !checklist;
  document.getElementById('viewRoadmap').hidden = checklist;
  document.getElementById('tabChecklist').classList.toggle('active', checklist);
  document.getElementById('tabRoadmap').classList.toggle('active', !checklist);
  document.getElementById('tabChecklist').setAttribute('aria-selected', String(checklist));
  document.getElementById('tabRoadmap').setAttribute('aria-selected', String(!checklist));
}

function setSpoiler(on) {
  spoilerEl.checked = on;
  localStorage.setItem(SPOILER_KEY, on ? '1' : '0');
  renderChecklist();
}

document.getElementById('tabChecklist').addEventListener('click', () => switchTab('checklist'));
document.getElementById('tabRoadmap').addEventListener('click', () => switchTab('roadmap'));
document.getElementById('kindFilters').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-kind]');
  if (!button) return;
  kindFilter = button.dataset.kind;
  for (const b of document.querySelectorAll('#kindFilters .kind')) b.classList.toggle('active', b === button);
  renderChecklist();
});
searchEl.addEventListener('input', renderChecklist);
gradeEl.addEventListener('change', renderChecklist);
spoilerEl.addEventListener('change', () => setSpoiler(spoilerEl.checked));
earnedOnlyEl.addEventListener('change', renderChecklist);
document.getElementById('export').addEventListener('click', exportProgress);
document.getElementById('import').addEventListener('change', (event) => {
  importProgress(event.target.files[0]);
  event.target.value = '';
});
document.getElementById('reset').addEventListener('click', resetProgress);

spoilerEl.checked = localStorage.getItem(SPOILER_KEY) === '1';
renderProgress();
renderChecklist();
