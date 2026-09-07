/* Service worker: o app abre e funciona mesmo sem sinal.
   Casca do app em cache; dados sempre da rede, com o cache como rede de segurança. */
const VERSAO = 'agenda-11-v1';
const CASCA = [
  './', './index.html', './styles.css', './app.js', './config.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSAO).then(c => c.addAll(CASCA)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* chamadas ao Supabase nunca vão para o cache */
  if (url.hostname.endsWith('supabase.co')) return;

  /* navegação: tenta a rede, cai para a casca guardada */
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  ev.respondWith(
    caches.match(req).then(hit => {
      const rede = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copia = res.clone();
          caches.open(VERSAO).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
