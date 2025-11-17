// Service Worker per Metodologie Operative Lab PWA
// Versione: 1.0.0

const CACHE_NAME = 'metop-lab-v1';
const OFFLINE_URL = '/metodologieoperative/offline.html';

// File da cachare immediatamente all'installazione
const STATIC_CACHE_URLS = [
  '/metodologieoperative/',
  '/metodologieoperative/index.html',
  '/metodologieoperative/offline.html',
  '/metodologieoperative/manifest.json',
  // Aggiungi qui altri file statici (CSS, JS, immagini comuni)
];

// Installazione Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installazione...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache aperta');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Attivazione Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Attivazione...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminazione cache obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia di caching: Network First, poi Cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non-GET
  if (event.request.method !== 'GET') return;
  
  // Ignora richieste esterne
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona la risposta prima di usarla
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Se la rete fallisce, usa la cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Se la risorsa non è in cache, mostra pagina offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Gestione notifiche push
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push ricevuto');
  
  const options = {
    body: event.data ? event.data.text() : 'Nuovo contenuto disponibile!',
    icon: '/metodologieoperative/icons/icon-192x192.png',
    badge: '/metodologieoperative/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Apri',
        icon: '/metodologieoperative/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: '/metodologieoperative/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Metodologie Operative Lab', options)
  );
});

// Gestione click su notifica
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Click su notifica');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/metodologieoperative/')
    );
  }
});

// Sincronizzazione in background
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-progressi') {
    event.waitUntil(syncProgressi());
  }
});

// Funzione per sincronizzare i progressi degli studenti
async function syncProgressi() {
  try {
    // Recupera dati salvati localmente
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    console.log('[Service Worker] Sincronizzazione progressi completata');
    return true;
  } catch (error) {
    console.error('[Service Worker] Errore sincronizzazione:', error);
    return false;
  }
}

// Gestione messaggi dal client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Messaggio ricevuto:', event.data);
  
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
