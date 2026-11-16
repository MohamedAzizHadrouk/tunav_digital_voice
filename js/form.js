// TUNAV DIGITAL VOICE – dynamic questionnaire
// Flow: welcome → I (identification) → T (everyone) → C or N (from I-05) → department section (from I-03) → done
(function () {
  const OTHER = '__other';
  const EXTRA = '__extra';
  const MAX_EXTRA = 3;
  const DRAFT_KEY = 'dv-draft-v1';
  const UI = {
    start: { fr: 'Commencer', tn: 'نبداو' },
    next: { fr: 'Suivant', tn: 'التالي' },
    back: { fr: 'Retour', tn: 'رجوع' },
    submit: { fr: 'Envoyer mes réponses', tn: 'ابعث الأجوبة متاعي' },
    sending: { fr: 'Envoi…', tn: 'قاعد يتبعث…' },
    step: { fr: 'Étape', tn: 'المرحلة' },
    of: { fr: 'sur', tn: 'من' },
    required: { fr: 'Réponse obligatoire.', tn: 'الجواب واجب.' },
    rankNeed: { fr: 'Classez {n} éléments (cliquez dans l’ordre).', tn: 'رتّب {n} عناصر (انزل بالترتيب).' },
    rankHint: { fr: 'Cliquez dans l’ordre de préférence ; cliquez à nouveau pour retirer.', tn: 'انزل بالترتيب حسب الأهمية؛ انزل مرة أخرى باش تنحّي.' },
    maxHint: { fr: '{n} choix maximum.', tn: '{n} اختيارات على الأكثر.' },
    multiHint: { fr: 'Plusieurs réponses possibles.', tn: 'تنجم تختار أكثر من جواب.' },
    other: { fr: 'Autre (précisez)', tn: 'حاجة أخرى (وضّح)' },
    otherNeed: { fr: 'Précisez « Autre ».', tn: 'وضّح «حاجة أخرى».' },
    addComp: { fr: '+ Ajouter un concurrent', tn: '+ زيد منافس' },
    compName: { fr: 'Nom du concurrent', tn: 'إسم المنافس' },
    remove: { fr: 'Retirer', tn: 'نحّي' },
    extraNeed: { fr: 'Pour chaque concurrent ajouté, indiquez son nom et choisissez une note (ou retirez-le).', tn: 'لكل منافس زدتو، اكتب إسمو واختار تقييم (ولّا نحّيه).' },
    fixErrors: { fr: 'Merci de compléter les réponses signalées en rouge.', tn: 'يعيشك كمّل الأجوبة إلّي باللون الأحمر.' },
    npsLow: { fr: '0 – Pas du tout probable', tn: '0 – بالكل لا' },
    npsHigh: { fr: '10 – Très probable', tn: '10 – أكيد' },
    sendErr: { fr: 'L’envoi a échoué. Vérifiez votre connexion et réessayez.', tn: 'ما تبعثش. ثبّت في الكونكسيون وعاود.' },
    demo: { fr: 'Mode démo : Supabase n’est pas configuré, les réponses restent dans ce navigateur.', tn: 'وضع تجريبي: الأجوبة تقعد في المتصفح هذا برك.' },
    draft: { fr: 'Votre brouillon a été restauré.', tn: 'المسودّة متاعك رجعت.' },
    again: { fr: 'Saisir une nouvelle réponse', tn: 'جواب جديد' },
    duration: { fr: '15 à 20 minutes · réponses nominatives · usage interne', tn: '15 لـ20 دقيقة · بالإسم · استعمال داخلي' },
    deadline: { fr: 'Merci de répondre dans la semaine qui suit la réception.', tn: 'يعيشك جاوب في الجمعة إلّي بعد ما يوصلك.' }
  };
  const S = { q: null, lang: 'fr', answers: {}, step: -1, started: null, done: false, sending: false, restored: false };
  const $main = document.getElementById('main');
  const $nav = document.getElementById('navbar');
  const $back = document.getElementById('btn-back');
  const $next = document.getElementById('btn-next');

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = o => (o && (o[S.lang] || o.fr)) || '';
  const u = (k, n) => t(UI[k]).replace('{n}', n);
  const sectionById = id => S.q.sections.find(s => s.id === id);
  const allQuestions = () => S.q.sections.flatMap(s => s.questions.map(q => ({ ...q, section: s.id })));
  const gotoOf = (qid) => {
    const q = sectionById('I').questions.find(x => x.id === qid);
    const o = q && q.options.find(x => x.fr === S.answers[qid]);
    return o ? o.goto : null;
  };
  const steps = () => ['I', 'T', gotoOf('I-05'), gotoOf('I-03')].filter(Boolean);

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ a: S.answers, l: S.lang, s: S.step, t: S.started })); } catch (e) { /* storage unavailable */ }
  }
  function loadDraft() {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d && d.a) { S.answers = d.a; S.lang = d.l || 'fr'; S.step = Math.max(-1, d.s | 0); S.started = d.t || null; S.restored = Object.keys(d.a).length > 0; } } catch (e) { /* ignore */ }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  function setLang(l) {
    S.lang = l;
    document.documentElement.lang = l === 'tn' ? 'ar' : 'fr';
    document.documentElement.dir = l === 'tn' ? 'rtl' : 'ltr';
    document.querySelectorAll('.lang-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    const al = document.getElementById('admin-link-label'); if (al) al.textContent = l === 'tn' ? 'دخول الإدارة' : 'Connexion admin';
    saveDraft();
    render();
  }

  // ---------- rendering ----------
  function render() {
    if (!S.q) return;
    const st = steps();
    const total = st.length;
    document.getElementById('progress').style.width = S.done ? '100%' : S.step < 0 ? '0%' : Math.round((S.step / total) * 100) + '%';
    if (S.done) return renderDone();
    if (S.step < 0) return renderWelcome();
    if (S.step >= total) S.step = total - 1;
    const sec = sectionById(st[S.step]);
    let html = '';
    if (DV.demo) html += `<div class="banner warn">${esc(u('demo'))}</div>`;
    if (S.restored && S.step === 0) html += `<div class="banner ok" style="margin-top:8px">${esc(u('draft'))}</div>`;
    html += `<div class="section-head" style="margin-top:16px"><h1>${esc(t(sec.title))}</h1></div>`;
    let block = null;
    sec.questions.forEach(q => {
      const b = q.block ? t(q.block) : null;
      if (b && b !== block) { html += `<div><span class="block-title">${esc(b)}</span></div>`; block = b; }
      html += renderQuestion(q);
    });
    $main.innerHTML = html;
    $nav.classList.remove('hidden');
    $back.textContent = u('back');
    $back.disabled = false;
    const last = S.step === total - 1;
    $next.textContent = S.sending ? u('sending') : last ? u('submit') : u('next');
    $next.disabled = S.sending;
    document.getElementById('step-label').textContent = `${u('step')} ${S.step + 1} ${u('of')} ${total}`;
    bind();
  }

  const ICON = {
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };
  const W = {
    eyebrow: { fr: 'Questionnaire interne · TUNAV ONE', tn: 'استبيان داخلي · TUNAV ONE' },
    title: { fr: 'Votre voix construit la voix de TUNAV', tn: 'صوتك يبني صوت TUNAV' },
    lead: { fr: 'TUNAV ONE va réunir nos solutions dans un seul écosystème. Pour bien en parler à nos clients, à Tunis et sur nos réseaux, nous avons besoin de votre expérience du terrain.', tn: 'TUNAV ONE باش تجمع الحلول متاعنا في نظام واحد. باش نحكيو عليه مليح مع الحرفاء، في تونس وفي المنصات متاعنا، نستحقّو التجربة متاعك في الميدان.' },
    chip1: { fr: '15 à 20 minutes', tn: '15 لـ20 دقيقة' },
    chip2: { fr: 'Usage interne – rien n’est publié sans votre accord', tn: 'استعمال داخلي – حتى شي ما يتنشر من غير موافقتك' },
    chip3: { fr: 'À remplir dans la semaine', tn: 'عمّرو في ظرف جمعة' },
    how: { fr: 'Comment ça se passe', tn: 'كيفاش يتعدّى' },
    s1: { fr: 'Qui vous êtes', tn: 'شكونك' }, s1d: { fr: 'Nom, poste, département', tn: 'الإسم، الخطة، القسم' },
    s2: { fr: 'Questions pour tous', tn: 'أسئلة للكل' }, s2d: { fr: 'TUNAV, nos produits, TUNAV ONE', tn: 'TUNAV، المنتوجات، TUNAV ONE' },
    s3: { fr: 'Votre lien avec les clients', tn: 'علاقتك بالحرفاء' }, s3d: { fr: 'Selon votre contact avec eux', tn: 'حسب تعاملك معاهم' },
    s4: { fr: 'Votre métier', tn: 'خدمتك' }, s4d: { fr: 'Questions de votre département', tn: 'أسئلة القسم متاعك' },
    reassure: { fr: 'Il n’y a pas de bonne ou de mauvaise réponse. Votre brouillon est gardé si vous quittez la page.', tn: 'ما فماش جواب صحيح وجواب غالط. المسودّة متاعك تتحفظ كان تخرج من الصفحة.' },
    chooseLang: { fr: 'Langue du questionnaire', tn: 'لغة الاستبيان' }
  };
  function renderWelcome() {
    $nav.classList.add('hidden');
    const w = k => esc(t(W[k]));
    const steps4 = [['s1', 's1d'], ['s2', 's2d'], ['s3', 's3d'], ['s4', 's4d']];
    $main.innerHTML = `
      <section class="welcome">
        <div class="welcome-visual" aria-hidden="true">
          <span class="orbit o1"></span><span class="orbit o2"></span><span class="orbit o3"></span>
          <span class="dot d1"></span><span class="dot d2"></span>
          <img src="assets/tunav-symbole-original.svg" alt="">
          <span class="visual-tag">One intelligent ecosystem</span>
        </div>
        <div class="welcome-body">
          ${DV.demo ? `<p class="demo-pill" title="${esc(u('demo'))}">${S.lang === 'tn' ? 'وضع تجريبي' : 'Mode démo'}</p>` : ''}
          <span class="eyebrow">${w('eyebrow')}</span>
          <h1 class="welcome-title">${w('title')}</h1>
          <p class="welcome-lead">${w('lead')}</p>
          <ul class="chips">
            <li>${ICON.clock}<span>${w('chip1')}</span></li>
            <li>${ICON.lock}<span>${w('chip2')}</span></li>
            <li>${ICON.calendar}<span>${w('chip3')}</span></li>
          </ul>
          <div class="welcome-actions">
            <button type="button" class="btn btn-primary btn-lg" id="btn-start">${esc(u('start'))} ${ICON.arrow}</button>
            <div class="welcome-lang" role="group" aria-label="${w('chooseLang')}">
              <span class="small muted">${w('chooseLang')} :</span>
              <button type="button" class="link-btn ${S.lang === 'fr' ? 'on' : ''}" data-wlang="fr">Français</button>
              <button type="button" class="link-btn ar ${S.lang === 'tn' ? 'on' : ''}" data-wlang="tn">تونسي</button>
            </div>
          </div>
        </div>
      </section>
      <section class="how">
        <h2 class="how-title">${w('how')}</h2>
        <ol class="how-steps">${steps4.map(([a, b], i) => `<li><span class="how-num">${i + 1}</span><strong>${w(a)}</strong><span>${w(b)}</span></li>`).join('')}</ol>
        <p class="small muted how-note">${w('reassure')}</p>
      </section>`;
    document.getElementById('btn-start').addEventListener('click', () => {
      if (!S.started) S.started = Date.now();
      S.step = 0; saveDraft(); render(); $main.focus(); window.scrollTo(0, 0);
    });
    $main.querySelectorAll('[data-wlang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.wlang)));
  }

  function renderDone() {
    $nav.classList.add('hidden');
    $main.innerHTML = `
      <section class="hero">
        <h1>${S.lang === 'tn' ? 'يعطيك الصحة!' : 'Merci !'}</h1>
        <p style="margin:0">${esc(t(S.q.end))}</p>
      </section>
      <p style="margin-top:24px"><button type="button" class="btn btn-ghost btn-sm" id="btn-again">${esc(u('again'))}</button></p>`;
    document.getElementById('btn-again').addEventListener('click', () => {
      S.answers = {}; S.step = -1; S.done = false; S.started = null; S.restored = false; clearDraft(); render();
    });
  }

  function hint(q) {
    if (q.type === 'ranking') return u('rankHint');
    if (q.type === 'multi') return q.max ? u('maxHint', q.max) : u('multiHint');
    return '';
  }

  function renderQuestion(q) {
    const name = q.id;
    const v = S.answers[q.id];
    const h = hint(q);
    let body = '';
    const opts = (q.options || []).slice();
    if (q.other) opts.push({ fr: OTHER, tn: OTHER, other: true });
    const optLabel = o => (o.other ? u('other') : t(o));
    const otherBox = (show) => `<input type="text" class="other-input ${show ? '' : 'hidden'}" data-other="${q.id}" value="${esc(S.answers[q.id + OTHER] || '')}" aria-label="${esc(u('other'))}">`;

    switch (q.type) {
      case 'open-short':
        body = `<input type="text" data-q="${q.id}" value="${esc(v || '')}" maxlength="200" aria-labelledby="l-${q.id}">`; break;
      case 'open-long':
        body = `<textarea data-q="${q.id}" maxlength="3000" aria-labelledby="l-${q.id}">${esc(v || '')}</textarea>`; break;
      case 'single':
        body = `<div class="options" role="radiogroup" aria-labelledby="l-${q.id}">${opts.map(o => `
          <label class="opt"><input type="radio" name="${name}" data-q="${q.id}" value="${esc(o.fr)}" ${v === o.fr ? 'checked' : ''}><span>${esc(optLabel(o))}</span></label>`).join('')}</div>
          ${q.other ? otherBox(v === OTHER) : ''}`; break;
      case 'multi': {
        const arr = Array.isArray(v) ? v : [];
        const full = q.max && arr.length >= q.max;
        body = `<div class="options" aria-labelledby="l-${q.id}">${opts.map(o => {
          const on = arr.includes(o.fr); const dis = full && !on;
          return `<label class="opt ${dis ? 'disabled' : ''}"><input type="checkbox" data-q="${q.id}" value="${esc(o.fr)}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><span>${esc(optLabel(o))}</span></label>`;
        }).join('')}</div>${q.other ? otherBox(arr.includes(OTHER)) : ''}`; break;
      }
      case 'ranking': {
        const arr = Array.isArray(v) ? v : [];
        body = `<div class="options" aria-labelledby="l-${q.id}">${opts.map(o => {
          const i = arr.indexOf(o.fr);
          return `<button type="button" class="opt rank-opt ${i >= 0 ? 'ranked' : ''}" data-rank="${q.id}" data-value="${esc(o.fr)}" aria-pressed="${i >= 0}">
            <span>${esc(optLabel(o))}</span><span class="rank-num">${i >= 0 ? i + 1 : ''}</span></button>`;
        }).join('')}</div>${q.other ? otherBox(arr.includes(OTHER)) : ''}`; break;
      }
      case 'scale':
        body = pills(q.id, name, S.q.scales[q.scale], v); break;
      case 'matrix': {
        const m = v && typeof v === 'object' ? v : {};
        body = q.rows.map((r, i) => `<div class="matrix-row"><div class="row-label">${esc(t(r))}</div>
          ${pills(q.id, `${name}__${i}`, S.q.scales[q.scale], m[r.fr], r.fr)}</div>`).join('');
        if (q.other) {
          const ex = extrasOf(q.id);
          body += ex.map((e, i) => `<div class="matrix-row extra-row">
            <div class="extra-head"><input type="text" maxlength="80" data-extra-name="${i}" data-eq="${q.id}" value="${esc(e.name || '')}" placeholder="${esc(u('compName'))}" aria-label="${esc(u('compName'))} ${i + 1}">
            <button type="button" class="btn btn-ghost btn-sm" data-extra-del="${i}" data-eq="${q.id}">${esc(u('remove'))}</button></div>
            ${pills(q.id, `${name}__x${i}`, S.q.scales[q.scale], e.value, null, `data-extra-val="${i}" data-eq="${q.id}"`)}</div>`).join('');
          if (ex.length < MAX_EXTRA) body += `<button type="button" class="btn btn-secondary btn-sm add-extra" data-extra-add="${q.id}">${esc(u('addComp'))}</button>`;
        }
        break;
      }
      case 'nps':
        body = pills(q.id, name, Array.from({ length: 11 }, (_, i) => ({ value: String(i), fr: String(i), tn: String(i) })), v == null ? null : String(v))
          + `<div class="nps-ends"><span>${esc(u('npsLow'))}</span><span>${esc(u('npsHigh'))}</span></div>`; break;
      case 'consent':
        body = `<label class="opt"><input type="checkbox" data-q="${q.id}" data-consent="1" ${v === true ? 'checked' : ''}><span>${S.lang === 'tn' ? 'موافق' : 'J’ai compris et j’accepte'}</span></label>`; break;
    }
    return `<div class="q" id="q-${q.id}" data-qbox="${q.id}">
      <label class="q-label" id="l-${q.id}"><span class="q-id">${esc(q.id)}</span>${esc(t(q.text))}${q.required ? '<span class="req" aria-hidden="true">*</span>' : ''}</label>
      ${h ? `<div class="q-hint">${esc(h)}</div>` : ''}
      ${body}
      <div class="q-error" role="alert" id="e-${q.id}"></div>
    </div>`;
  }

  function pills(qid, name, scale, val, row, attrs) {
    const a = attrs || `data-q="${qid}" ${row ? `data-row="${esc(row)}"` : ''}`;
    return `<div class="pills" role="radiogroup">${scale.map(s => `
      <label class="pill"><input type="radio" name="${esc(name)}" ${a} value="${esc(s.value)}" ${val === s.value ? 'checked' : ''}>
      <span>${esc(/^\d+$/.test(s.value) && s.fr !== s.value ? `${s.value} · ${t(s)}` : t(s))}</span></label>`).join('')}</div>`;
  }

  // ---------- events ----------
  function bind(root) {
    root = root || $main;
    const qOf = id => allQuestions().find(x => x.id === id);
    root.querySelectorAll('input[data-q], textarea[data-q]').forEach(el => {
      const ev = el.type === 'text' || el.tagName === 'TEXTAREA' ? 'input' : 'change';
      el.addEventListener(ev, () => {
        const q = qOf(el.dataset.q);
        if (q.type === 'open-short' || q.type === 'open-long') S.answers[q.id] = el.value;
        else if (q.type === 'single') S.answers[q.id] = el.value;
        else if (q.type === 'multi') {
          const arr = Array.from($main.querySelectorAll(`input[type=checkbox][data-q="${q.id}"]:checked`)).map(x => x.value);
          S.answers[q.id] = arr;
        } else if (q.type === 'scale') S.answers[q.id] = el.value;
        else if (q.type === 'nps') S.answers[q.id] = Number(el.value);
        else if (q.type === 'matrix') { S.answers[q.id] = { ...(S.answers[q.id] || {}), [el.dataset.row]: el.value }; }
        else if (q.type === 'consent') S.answers[q.id] = el.checked;
        clearError(q.id);
        saveDraft();
        if (q.type === 'single' || q.type === 'multi') refreshQuestion(q);
      });
    });
    root.querySelectorAll('[data-rank]').forEach(btn => btn.addEventListener('click', () => {
      const q = qOf(btn.dataset.rank);
      const arr = Array.isArray(S.answers[q.id]) ? S.answers[q.id].slice() : [];
      const i = arr.indexOf(btn.dataset.value);
      const need = rankNeed(q);
      if (i >= 0) arr.splice(i, 1); else if (arr.length < need) arr.push(btn.dataset.value);
      S.answers[q.id] = arr; clearError(q.id); saveDraft(); refreshQuestion(q);
    }));
    root.querySelectorAll('[data-extra-add]').forEach(b => b.addEventListener('click', () => {
      const q = qOf(b.dataset.extraAdd);
      S.answers[q.id + EXTRA] = extrasOf(q.id).concat([{ name: '', value: null }]);
      saveDraft(); refreshQuestion(q);
      const inputs = document.querySelectorAll(`#q-${q.id} [data-extra-name]`); if (inputs.length) inputs[inputs.length - 1].focus();
    }));
    root.querySelectorAll('[data-extra-del]').forEach(b => b.addEventListener('click', () => {
      const q = qOf(b.dataset.eq);
      const ex = extrasOf(q.id).slice(); ex.splice(+b.dataset.extraDel, 1);
      S.answers[q.id + EXTRA] = ex; clearError(q.id); saveDraft(); refreshQuestion(q);
    }));
    root.querySelectorAll('[data-extra-name]').forEach(el => el.addEventListener('input', () => {
      const ex = extrasOf(el.dataset.eq).slice(); ex[+el.dataset.extraName] = { ...ex[+el.dataset.extraName], name: el.value };
      S.answers[el.dataset.eq + EXTRA] = ex; clearError(el.dataset.eq); saveDraft();
    }));
    root.querySelectorAll('[data-extra-val]').forEach(el => el.addEventListener('change', () => {
      const ex = extrasOf(el.dataset.eq).slice(); ex[+el.dataset.extraVal] = { ...ex[+el.dataset.extraVal], value: el.value };
      S.answers[el.dataset.eq + EXTRA] = ex; clearError(el.dataset.eq); saveDraft();
    }));
    root.querySelectorAll('[data-other]').forEach(el => el.addEventListener('input', () => {
      S.answers[el.dataset.other + OTHER] = el.value; clearError(el.dataset.other); saveDraft();
    }));
  }

  function refreshQuestion(q) {
    const box = document.getElementById('q-' + q.id);
    const tmp = document.createElement('div');
    tmp.innerHTML = renderQuestion(q);
    const fresh = tmp.firstElementChild;
    box.replaceWith(fresh);
    bind(fresh);
  }

  function extrasOf(qid) { const e = S.answers[qid + EXTRA]; return Array.isArray(e) ? e : []; }
  const rankNeed = q => Math.min(q.max || q.options.length, q.options.length + (q.other ? 1 : 0));

  // ---------- validation ----------
  function errorOf(q) {
    const v = S.answers[q.id];
    const otherSel = (q.type === 'single' && v === OTHER) || (Array.isArray(v) && v.includes(OTHER));
    if (otherSel && !(S.answers[q.id + OTHER] || '').trim()) return u('otherNeed');
    if (q.type === 'matrix' && q.other && extrasOf(q.id).some(e => !((e.name || '').trim() && e.value))) return u('extraNeed');
    if (!q.required) return '';
    switch (q.type) {
      case 'open-short': case 'open-long': return (v || '').trim() ? '' : u('required');
      case 'single': case 'scale': return v ? '' : u('required');
      case 'multi': return Array.isArray(v) && v.length ? '' : u('required');
      case 'ranking': { const n = rankNeed(q); return Array.isArray(v) && v.length >= n ? '' : u('rankNeed', n); }
      case 'matrix': return v && q.rows.every(r => v[r.fr]) ? '' : u('required');
      case 'nps': return typeof v === 'number' ? '' : u('required');
      case 'consent': return v === true ? '' : u('required');
    }
    return '';
  }
  function clearError(id) { const b = document.getElementById('q-' + id); if (b) b.classList.remove('invalid'); }
  function validateSection(sec) {
    let first = null;
    sec.questions.forEach(q => {
      const e = errorOf(q);
      const b = document.getElementById('q-' + q.id);
      b.classList.toggle('invalid', !!e);
      document.getElementById('e-' + q.id).textContent = e;
      if (e && !first) first = b;
    });
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); const f = first.querySelector('input,textarea,button'); if (f) f.focus({ preventScroll: true }); }
    return !first;
  }

  // ---------- navigation & submit ----------
  $back.addEventListener('click', () => { S.step -= 1; saveDraft(); render(); window.scrollTo(0, 0); });
  $next.addEventListener('click', async () => {
    const st = steps();
    const sec = sectionById(st[S.step]);
    if (!validateSection(sec)) return;
    if (S.step < st.length - 1) { S.step += 1; saveDraft(); render(); $main.focus(); window.scrollTo(0, 0); return; }
    await submit(st);
  });

  async function submit(st) {
    const keep = new Set(st.flatMap(id => sectionById(id).questions.map(q => q.id)));
    const answers = {};
    Object.keys(S.answers).forEach(k => {
      const base = k.replace(/__(other|extra)$/, '');
      if (!keep.has(base)) return;
      let val = S.answers[k];
      if (k.endsWith(EXTRA)) val = (val || []).filter(e => (e.name || '').trim() && e.value).map(e => ({ name: e.name.trim(), value: e.value }));
      if (k.endsWith(OTHER)) {
        const main = S.answers[base];
        if (!(main === OTHER || (Array.isArray(main) && main.includes(OTHER)))) return;
      }
      if (val === '' || (Array.isArray(val) && !val.length)) return;
      answers[k] = val;
    });
    const row = {
      questionnaire_version: S.q.version,
      lang: S.lang,
      respondent_name: (S.answers['I-01'] || '').trim(),
      respondent_position: (S.answers['I-02'] || '').trim() || null,
      department: gotoOf('I-03'),
      client_contact: gotoOf('I-05'),
      answers,
      duration_seconds: S.started ? Math.min(86400, Math.round((Date.now() - S.started) / 1000)) : null
    };
    S.sending = true; render();
    try {
      await DV.submit(row);
      S.sending = false; S.done = true; clearDraft(); render(); window.scrollTo(0, 0);
    } catch (e) {
      S.sending = false; render();
      $main.insertAdjacentHTML('afterbegin', `<div class="banner err">${esc(u('sendErr'))}<br><span class="small">${esc(e.message)}</span></div>`);
      window.scrollTo(0, 0);
    }
  }

  document.querySelectorAll('.lang-switch button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  DV.loadQuestionnaire().then(q => {
    S.q = q;
    loadDraft();
    setLang(S.lang);
  }).catch(e => {
    $main.innerHTML = `<div class="banner err">Impossible de charger le questionnaire : ${esc(e.message)}</div>`;
  });
})();
