// node scripts/verify-ai-endpoints.js "login:password"
// 1) AI Mode live  2) Gemini LLM Scraper task_post + espera + task_get. Imprime costo y estructura.
const fs = require('fs');
const [login, password] = (process.argv[2] || '').split(/:(.+)/);
const auth = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
const call = async (method, path, body) => {
   const r = await fetch(`https://api.dataforseo.com/v3${path}`, {
      method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
   });
   return r.json();
};
(async () => {
   const q = '¿Dónde puedo arrendar un vestido de fiesta en Temuco?';
   const live = await call('POST', '/serp/google/ai_mode/live/advanced', [{ keyword: q, location_code: 2152, language_code: 'es', device: 'mobile' }]);
   fs.writeFileSync('__tests__/fixtures/ai/ai-mode-ammo.json', JSON.stringify(live, null, 1));
   const t = live.tasks[0];
   console.log('AI MODE live', t.status_code, t.status_message, 'cost', live.cost);
   const r = (t.result || [])[0] || {};
   console.log('  item types:', (r.items || []).map((i) => i.type), 'keys:', Object.keys((r.items || [])[0] || {}));
   const post = await call('POST', '/ai_optimization/gemini/llm_scraper/task_post', [{ keyword: q, location_code: 20153, language_code: 'es' }]);
   const id = post.tasks[0].id;
   console.log('GEMINI task_post', post.tasks[0].status_code, 'cost', post.cost, 'id', id);
   for (let i = 0; i < 40; i += 1) {
      await new Promise((ok) => setTimeout(ok, 15000));
      const got = await call('GET', `/ai_optimization/gemini/llm_scraper/task_get/advanced/${id}`);
      const g = got.tasks[0];
      console.log(`  intento ${i + 1}:`, g.status_code, g.status_message);
      if (g.status_code === 20000) { fs.writeFileSync('__tests__/fixtures/ai/gemini-task-get.json', JSON.stringify(got, null, 1)); break; }
   }
})();
