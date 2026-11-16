// TUNAV DIGITAL VOICE – admin page (read-only): list, detail, statistics, export
(function () {
  const OTHER = '__other';
  const DEPTS = { DIR: 'Direction', COM: 'Commercial', SAV: 'SAV', ADM: 'Administration / RH / Finance', TEC: 'Technique', IT: 'IT' };
  const CONTACT = { C: 'Contact direct', N: 'Sans contact direct' };
  const S = { q: null, rows: [], filtered: [], tab: 'list' };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = d => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const fmtDur = s => (s == null ? '–' : `${Math.round(s / 60)} min`);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  let QS = [];

  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function banner(html, cls) { $('banner').innerHTML = html ? `<div class="banner ${cls}" style="margin-bottom:16px">${html}</div>` : ''; }

  // ---------- auth ----------
  async function start() {
    try {
      S.q = await DV.loadQuestionnaire();
      QS = S.q.sections.flatMap(s => s.questions.map(q => ({ ...q, section: s.id, sectionTitle: s.title.fr, audience: s.audience })));
    } catch (e) { banner('Impossible de charger le questionnaire : ' + esc(e.message), 'err'); return; }
    if (DV.demo) banner('Mode démo : Supabase n’est pas configuré (js/config.js). Les réponses affichées sont celles enregistrées dans ce navigateur.', 'warn');
    const user = await DV.session().catch(() => null);
    if (!user) { show('login', true); return; }
    await enter(user);
  }
  async function enter(user) {
    try {
      if (!(await DV.isAdmin())) {
        show('login', false);
        banner('Ce compte n’est pas autorisé. Ajoutez son email dans la table <code>dv_admins</code> (voir README).', 'err');
        show('btn-logout', true); return;
      }
    } catch (e) { banner('Erreur : ' + esc(e.message), 'err'); return; }
    $('who').textContent = DV.demo ? 'Démo' : user.email;
    show('btn-logout', !DV.demo);
    show('login', false); show('app', true);
    await load();
  }
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    show('login-error', false);
    try { await DV.signIn($('email').value.trim(), $('password').value); $('password').value = ''; await enter(await DV.session()); }
    catch (err) { $('login-error').textContent = 'Connexion impossible : ' + err.message; show('login-error', true); }
  });
  $('btn-logout').addEventListener('click', async () => { await DV.signOut(); location.reload(); });

  // ---------- data ----------
  async function load() {
    try { S.rows = await DV.listResponses(); }
    catch (e) { banner('Lecture des réponses impossible : ' + esc(e.message), 'err'); S.rows = []; }
    $('meta').textContent = `Questionnaire v${S.q.version} · ${S.rows.length} réponse(s) · mis à jour ${fmtDate(Date.now())}`;
    const sel = $('f-dept');
    if (sel.options.length === 1) Object.entries(DEPTS).forEach(([k, v]) => sel.insertAdjacentHTML('beforeend', `<option value="${k}">${esc(v)}</option>`));
    apply();
  }
  function apply() {
    const d = $('f-dept').value, c = $('f-contact').value, s = $('f-search').value.trim().toLowerCase();
    S.filtered = S.rows.filter(r => (!d || r.department === d) && (!c || r.client_contact === c) && (!s || (r.respondent_name || '').toLowerCase().includes(s)));
    renderKpis(); renderTab();
  }
  ['f-dept', 'f-contact'].forEach(id => $(id).addEventListener('change', apply));
  $('f-search').addEventListener('input', apply);
  $('btn-refresh').addEventListener('click', load);
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    S.tab = b.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderTab();
  }));

  // ---------- views ----------
  function renderKpis() {
    const r = S.filtered;
    const durs = r.map(x => x.duration_seconds).filter(x => x != null);
    const nps = npsOf(r.map(x => x.answers && x.answers['T-13']).filter(x => typeof x === 'number'));
    $('kpis').innerHTML = [
      [r.length, 'Réponses'],
      [r.filter(x => x.client_contact === 'C').length, 'Contact direct (C)'],
      [r.filter(x => x.client_contact === 'N').length, 'Sans contact direct (N)'],
      [durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60) + ' min' : '–', 'Durée moyenne'],
      [nps.n ? (nps.score > 0 ? '+' : '') + nps.score : '–', 'Recommandation (T-13, NPS)']
    ].map(([v, l]) => `<div class="kpi"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');
  }
  function renderTab() {
    ['list', 'stats', 'depts'].forEach(t => show('tab-' + t, S.tab === t));
    if (S.tab === 'list') renderList();
    if (S.tab === 'stats') renderStats();
    if (S.tab === 'depts') renderDepts();
  }
  function renderList() {
    if (!S.filtered.length) { $('tab-list').innerHTML = '<p class="muted">Aucune réponse pour ces filtres.</p>'; return; }
    $('tab-list').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Nom</th><th>Poste</th><th>Département</th><th>Contact client</th><th>Langue</th><th>Durée</th></tr></thead>
      <tbody>${S.filtered.map((r, i) => `<tr data-i="${i}" tabindex="0">
        <td>${esc(fmtDate(r.created_at))}</td><td>${esc(r.respondent_name)}</td><td>${esc(r.respondent_position || '–')}</td>
        <td>${esc(DEPTS[r.department] || r.department)}</td><td>${esc(CONTACT[r.client_contact] || r.client_contact)}</td>
        <td>${r.lang === 'tn' ? 'Tunisien' : 'Français'}</td><td>${esc(fmtDur(r.duration_seconds))}</td></tr>`).join('')}</tbody></table></div>`;
    $('tab-list').querySelectorAll('tr[data-i]').forEach(tr => {
      const open = () => openDetail(S.filtered[+tr.dataset.i]);
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
  }
  function renderDepts() {
    const n = S.filtered.length;
    const rows = Object.entries(DEPTS).map(([k, v]) => {
      const c = S.filtered.filter(r => r.department === k).length;
      return `<div class="bar-row"><span>${esc(v)}</span><span class="bar"><span style="width:${pct(c, n)}%"></span></span><span>${c}</span></div>`;
    }).join('');
    const contact = Object.entries(CONTACT).map(([k, v]) => {
      const c = S.filtered.filter(r => r.client_contact === k).length;
      return `<div class="bar-row"><span>${esc(v)}</span><span class="bar"><span style="width:${pct(c, n)}%"></span></span><span>${c}</span></div>`;
    }).join('');
    $('tab-depts').innerHTML = `<div class="card"><h3>Répartition par département</h3>${rows}</div>
      <div class="card" style="margin-top:16px"><h3>Contact avec les clients</h3>${contact}</div>`;
  }

  // ---------- answer formatting ----------
  const scaleLabel = (q, v) => { const s = (S.q.scales[q.scale] || []).find(x => x.value === v); return s ? (s.fr === v ? v : `${v} · ${s.fr}`) : v; };
  function fmtAnswer(q, a) {
    const v = a[q.id];
    if (v == null) return null;
    const other = a[q.id + OTHER];
    const lbl = x => (x === OTHER ? `Autre : ${other || ''}` : x);
    switch (q.type) {
      case 'single': return esc(lbl(v));
      case 'multi': return v.map(x => esc(lbl(x))).join('<br>');
      case 'ranking': return v.map((x, i) => `${i + 1}. ${esc(lbl(x))}`).join('<br>');
      case 'scale': return esc(scaleLabel(q, v));
      case 'matrix': return q.rows.filter(r => v[r.fr]).map(r => `${esc(r.fr)} → <strong>${esc(scaleLabel(q, v[r.fr]))}</strong>`)
        .concat((a[q.id + '__extra'] || []).map(e => `${esc(e.name)} <span class="badge">ajouté</span> → <strong>${esc(scaleLabel(q, e.value))}</strong>`)).join('<br>');
      case 'consent': return v ? 'Oui' : 'Non';
      default: return esc(v).replace(/\n/g, '<br>');
    }
  }
  function openDetail(r) {
    const a = r.answers || {};
    let html = `<div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
      <div><h2>${esc(r.respondent_name)}</h2><p class="muted small">${esc(r.respondent_position || '')} · ${esc(DEPTS[r.department] || '')} · ${esc(CONTACT[r.client_contact] || '')} · ${esc(fmtDate(r.created_at))} · ${r.lang === 'tn' ? 'répondu en tunisien' : 'répondu en français'}</p></div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-close">Fermer</button></div>`;
    S.q.sections.forEach(s => {
      const items = s.questions.map(q => ({ q, f: fmtAnswer(q, a) })).filter(x => x.f != null);
      if (!items.length) return;
      html += `<h3 style="margin-top:20px">${esc(s.title.fr)}</h3>` + items.map(({ q, f }) =>
        `<div class="detail-q"><div class="lbl">${esc(q.id)} · ${esc(q.text.fr)}</div><div>${f}</div></div>`).join('');
    });
    $('drawer').innerHTML = html;
    $('drawer').classList.add('open'); $('drawer-bg').classList.add('open');
    $('btn-close').addEventListener('click', closeDetail);
    $('btn-close').focus();
  }
  function closeDetail() { $('drawer').classList.remove('open'); $('drawer-bg').classList.remove('open'); }
  $('drawer-bg').addEventListener('click', closeDetail);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

  // ---------- statistics ----------
  function npsOf(vals) {
    if (!vals.length) return { n: 0, score: 0 };
    const pro = vals.filter(v => v >= 9).length, det = vals.filter(v => v <= 6).length;
    return { n: vals.length, score: Math.round(((pro - det) / vals.length) * 100), avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) };
  }
  const bars = (items, total) => items.map(([label, c, extra]) =>
    `<div class="bar-row"><span>${esc(label)}</span><span class="bar"><span style="width:${pct(c, total)}%"></span></span><span>${extra != null ? esc(extra) : c}</span></div>`).join('');
  const avgNum = arr => { const n = arr.map(Number).filter(x => !isNaN(x)); return n.length ? (n.reduce((a, b) => a + b, 0) / n.length) : null; };

  function statQuestion(q, rows) {
    const vals = rows.map(r => ({ v: (r.answers || {})[q.id], o: (r.answers || {})[q.id + OTHER], r })).filter(x => x.v != null && x.v !== '');
    const n = vals.length;
    let body = '';
    const otherList = () => { const l = vals.map(x => x.o).filter(Boolean); return l.length ? `<details style="margin-top:8px"><summary class="small">Réponses « Autre » (${l.length})</summary><ul class="answers-list">${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''; };
    const opts = (q.options || []).map(o => o.fr).concat(q.other ? [OTHER] : []);
    const optName = o => (o === OTHER ? 'Autre' : o);
    switch (q.type) {
      case 'single': case 'multi': {
        const counts = opts.map(o => [optName(o), vals.filter(x => (Array.isArray(x.v) ? x.v.includes(o) : x.v === o)).length]);
        counts.sort((a, b) => b[1] - a[1]);
        body = bars(counts.map(([l, c]) => [l, c, `${c} (${pct(c, n)} %)`]), n) + otherList(); break;
      }
      case 'ranking': {
        const max = Math.max(1, ...vals.map(x => x.v.length));
        const score = opts.map(o => {
          let pts = 0, first = 0;
          vals.forEach(x => { const i = x.v.indexOf(o); if (i >= 0) { pts += max - i; if (i === 0) first++; } });
          return [optName(o), pts, first];
        }).sort((a, b) => b[1] - a[1]);
        const top = Math.max(1, ...score.map(s => s[1]));
        body = `<p class="small muted">Score = points selon le rang (1er = ${max} pts). Entre parenthèses : nombre de fois classé 1er.</p>` +
          bars(score.map(([l, p, f]) => [l, p, `${p} (${f})`]), top) + otherList(); break;
      }
      case 'scale': {
        const sc = S.q.scales[q.scale];
        const a = avgNum(vals.map(x => x.v));
        body = (a != null ? `<p class="small">Moyenne : <strong>${a.toFixed(2)}</strong></p>` : '') + bars(sc.map(s => [`${s.value} · ${s.fr}`, vals.filter(x => x.v === s.value).length]), n); break;
      }
      case 'matrix': {
        const sc = S.q.scales[q.scale];
        const maxV = Math.max(...sc.map(s => Number(s.value)).filter(x => !isNaN(x)));
        body = `<p class="small muted">Moyenne par ligne sur ${maxV} (hors « ${esc(sc.find(s => isNaN(Number(s.value))) ? sc.find(s => isNaN(Number(s.value))).fr : '–')} »).</p>` +
          q.rows.map(r => {
            const rv = vals.map(x => x.v[r.fr]).filter(Boolean);
            const a = avgNum(rv);
            const na = rv.filter(v => isNaN(Number(v))).length;
            return `<div class="bar-row"><span>${esc(r.fr)}</span><span class="bar"><span style="width:${a == null ? 0 : pct(a, maxV)}%"></span></span><span>${a == null ? '–' : a.toFixed(1)}${na ? ` · ${na} N/A` : ''}</span></div>`;
          }).join('');
        if (q.other) {
          const groups = {};
          vals.forEach(x => ((x.r.answers || {})[q.id + '__extra'] || []).forEach(e => {
            const key = e.name.trim().toLowerCase();
            (groups[key] = groups[key] || { name: e.name.trim(), vals: [] }).vals.push(e.value);
          }));
          const list = Object.values(groups).sort((a, b) => b.vals.length - a.vals.length);
          if (list.length) body += `<p class="small" style="margin:12px 0 4px"><strong>Concurrents ajoutés par les répondants</strong> (nombre de citations · moyenne)</p>` +
            list.map(g => { const a = avgNum(g.vals); return `<div class="bar-row"><span>${esc(g.name)} (${g.vals.length})</span><span class="bar"><span style="width:${a == null ? 0 : pct(a, maxV)}%"></span></span><span>${a == null ? '–' : a.toFixed(1)}</span></div>`; }).join('');
        }
        break;
      }
      case 'nps': {
        const s = npsOf(vals.map(x => x.v));
        body = `<p class="small">NPS : <strong>${s.n ? s.score : '–'}</strong> · moyenne ${s.avg || '–'} / 10 · promoteurs (9–10) ${vals.filter(x => x.v >= 9).length} · détracteurs (0–6) ${vals.filter(x => x.v <= 6).length}</p>` +
          bars(Array.from({ length: 11 }, (_, i) => [String(i), vals.filter(x => x.v === i).length]), n); break;
      }
      case 'consent': body = `<p class="small">${n} accord(s).</p>`; break;
      default:
        body = n ? `<ul class="answers-list">${vals.map(x => `<li>${esc(x.v)} <span class="muted">— ${esc(x.r.respondent_name)} (${esc(x.r.department)})</span></li>`).join('')}</ul>` : '';
    }
    return `<div class="card stat-q"><div class="small muted">${esc(q.id)} · ${n} réponse(s) · ${esc((q.feeds || []).join(', '))}</div>
      <h3 style="font-size:16px;margin-top:4px">${esc(q.text.fr)}</h3>${n ? body : '<p class="small muted">Pas encore de réponse.</p>'}</div>`;
  }
  function renderStats() {
    const rows = S.filtered;
    let html = '<p class="small muted">Les statistiques suivent les filtres (département, contact client, nom).</p>';
    S.q.sections.forEach(s => {
      if (s.id === 'I') return;
      html += `<h2 style="margin-top:28px">${esc(s.title.fr)}</h2>` + s.questions.map(q => statQuestion(q, rows)).join('');
    });
    $('tab-stats').innerHTML = html;
  }

  // ---------- export ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function flat(q, a) {
    const v = a[q.id];
    if (v == null) return '';
    if (q.type === 'matrix') return q.rows.filter(r => v[r.fr]).map(r => `${r.fr}=${v[r.fr]}`).join(' | ');
    if (Array.isArray(v)) return v.map(x => (x === OTHER ? 'Autre' : x)).join(' | ');
    if (v === OTHER) return 'Autre';
    return String(v);
  }
  $('btn-csv').addEventListener('click', () => {
    const cols = ['id', 'date', 'nom', 'poste', 'departement', 'contact_client', 'langue', 'duree_s'];
    QS.forEach(q => { cols.push(q.id); if (q.other) cols.push(q.id + (q.type === 'matrix' ? '_ajouts' : '_autre')); });
    const cell = x => `"${String(x == null ? '' : x).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const lines = [cols.map(cell).join(';')];
    S.filtered.forEach(r => {
      const a = r.answers || {};
      const row = [r.id, r.created_at, r.respondent_name, r.respondent_position, DEPTS[r.department] || r.department, CONTACT[r.client_contact] || r.client_contact, r.lang, r.duration_seconds];
      QS.forEach(q => {
        row.push(flat(q, a));
        if (q.other) row.push(q.type === 'matrix' ? (a[q.id + '__extra'] || []).map(e => `${e.name}=${e.value}`).join(' | ') : (a[q.id + OTHER] || ''));
      });
      lines.push(row.map(cell).join(';'));
    });
    download(`tunav-digital-voice-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  });
  $('btn-json').addEventListener('click', () => download(`tunav-digital-voice-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.filtered, null, 2), 'application/json'));

  start();
})();
