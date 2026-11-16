// TUNAV DIGITAL VOICE – data layer: Supabase, or DEMO mode (browser storage) when config.js is empty
(function () {
  const cfg = window.DV_CONFIG || {};
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  const DEMO_KEY = 'dv-demo-responses';
  let client = null;
  if (!demo) {
    if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase library not loaded');
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
  const readDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) { return []; } };

  window.DV = {
    demo,
    async loadQuestionnaire() {
      const r = await fetch('data/questionnaire.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('questionnaire.json: ' + r.status);
      return r.json();
    },
    async submit(row) {
      if (demo) {
        const all = readDemo();
        all.unshift({ id: 'demo-' + Date.now(), created_at: new Date().toISOString(), ...row });
        try { localStorage.setItem(DEMO_KEY, JSON.stringify(all)); } catch (e) { throw new Error('Stockage local indisponible'); }
        return;
      }
      const { error } = await client.from('dv_responses').insert(row);
      if (error) throw new Error(error.message);
    },
    // --- admin ---
    async session() {
      if (demo) return { email: 'demo' };
      const { data } = await client.auth.getSession();
      return data.session ? data.session.user : null;
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signOut() { if (!demo) await client.auth.signOut(); },
    async isAdmin() {
      if (demo) return true;
      const { data, error } = await client.from('dv_admins').select('email').limit(1);
      if (error) throw new Error(error.message);
      return data.length > 0;
    },
    async listResponses() {
      if (demo) return readDemo();
      const out = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client.from('dv_responses').select('*').order('created_at', { ascending: false }).range(from, from + 999);
        if (error) throw new Error(error.message);
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    }
  };
})();
