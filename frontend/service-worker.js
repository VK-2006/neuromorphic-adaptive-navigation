const CACHE='navora-shell-v8-live-field';
const SHELL=[
  '/','/index.html','/login.html','/dashboard.html','/map.html','/journey.html','/history.html','/memory.html','/journey-replay.html',
  '/notifications.html','/profile.html','/settings.html','/devices.html','/world-chat.html','/offline.html','/manifest.json',
  '/assets/css/main.css','/assets/css/worldclass.css','/assets/js/theme.js','/assets/js/api.js','/assets/js/app-shell.js','/assets/js/worldclass-ui.js',
  '/assets/js/offline.js','/assets/js/map.js','/assets/js/journey.js','/assets/icons/navora.svg','/assets/icons/navora-192.png','/assets/icons/navora-512.png'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE)
    .then(async cache=>{for(const url of SHELL){try{await cache.add(url)}catch{}}})
    .then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.includes('socket.io'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response})
        .catch(async()=>await caches.match(event.request)||await caches.match('/offline.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request)
      .then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})
      .catch(()=>caches.match('/offline.html')))
  );
});
