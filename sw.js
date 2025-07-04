// 🇵🇸 Service Worker للمساعد الذكي - Palesti AI Edition
const CACHE_NAME = 'palesti-ai-v1.0';
const BASE_URL = '/pixelAi/';

// ملفات أساسية للتخزين المؤقت
const CACHE_URLS = [
  BASE_URL,
  BASE_URL + 'index.html',
  BASE_URL + 'manifest.json'
];

// Pollinations API endpoints to cache
const API_CACHE_URLS = [
  'https://pollinations.ai',
  'https://image.pollinations.ai',
  'https://text.pollinations.ai',
  'https://audio.pollinations.ai'
];

// صفحة أوفلاين محسنة
const OFFLINE_HTML = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Palesti AI - غير متصل</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            padding: 2rem;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 3rem;
            max-width: 400px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { font-size: 1.1rem; margin-bottom: 1.5rem; line-height: 1.6; }
        .btn {
            background: linear-gradient(135deg, #8B5CF6, #EC4899);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        .btn:hover { transform: translateY(-2px); }
        .cached-images {
            margin-top: 2rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
        }
        .cached-image {
            width: 100%;
            height: 100px;
            object-fit: cover;
            border-radius: 10px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🇵🇸 Palesti AI</h1>
        <p>⚠️ لا يوجد اتصال بالإنترنت</p>
        <p>يمكنك عرض المحتوى المحفوظ أو انتظار عودة الاتصال</p>
        <button class="btn" onclick="location.reload()">🔄 إعادة تحميل</button>
        <div class="cached-images" id="cachedImages"></div>
    </div>
    <script>
        // Show cached images if any
        if ('caches' in window) {
            caches.open('pollinations-ai-v1.0').then(cache => {
                cache.keys().then(keys => {
                    const imageUrls = keys.filter(req => 
                        req.url.includes('image.pollinations.ai')
                    ).slice(0, 6);
                    
                    const container = document.getElementById('cachedImages');
                    if (imageUrls.length > 0) {
                        container.innerHTML = '<h3 style="margin-bottom: 10px;">صور محفوظة:</h3>';
                        imageUrls.forEach(req => {
                            cache.match(req).then(response => {
                                if (response) {
                                    response.blob().then(blob => {
                                        const img = document.createElement('img');
                                        img.src = URL.createObjectURL(blob);
                                        img.className = 'cached-image';
                                        container.appendChild(img);
                                    });
                                }
                            });
                        });
                    }
                });
            });
        }
    </script>
</body>
</html>
`;

// 🔧 تثبيت Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: تثبيت...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 فتح الكاش:', CACHE_NAME);
                
                // تخزين صفحة أوفلاين
                cache.put(BASE_URL + 'offline.html', new Response(OFFLINE_HTML, {
                    headers: { 'Content-Type': 'text/html' }
                }));
                
                // تخزين الملفات الأساسية
                return Promise.allSettled(
                    CACHE_URLS.map(url => cache.add(url))
                );
            })
            .then(() => {
                console.log('✅ Service Worker: تم التثبيت بنجاح');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.warn('⚠️ خطأ في تثبيت Service Worker:', error);
            })
    );
});

// 🔄 تفعيل Service Worker
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: تفعيل...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ حذف كاش قديم:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker: تم التفعيل');
            return self.clients.claim();
        })
    );
});

// 🌐 اعتراض الطلبات
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // تجاهل الطلبات غير المدعومة
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension:')) {
        return;
    }
    
    // Cache strategy for Pollinations API
    if (url.hostname.includes('pollinations.ai')) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached version and update in background
                        fetchAndCache(event.request);
                        return cachedResponse;
                    }
                    
                    return fetchAndCache(event.request);
                })
                .catch(() => {
                    // Return cached offline page for navigation
                    if (event.request.mode === 'navigate') {
                        return caches.match(BASE_URL + 'offline.html');
                    }
                    return new Response('غير متصل', { status: 503 });
                })
        );
        return;
    }
    
    // Default strategy for other requests
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match(BASE_URL + 'offline.html');
                        }
                        return new Response('غير متصل', { status: 503 });
                    });
            })
    );
});

// Helper function to fetch and cache
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        
        // Only cache successful responses
        if (response.status === 200) {
            const responseClone = response.clone();
            const cache = await caches.open(CACHE_NAME);
            
            // Special handling for Pollinations images
            if (request.url.includes('image.pollinations.ai')) {
                // Cache images for longer
                cache.put(request, responseClone);
            } else {
                // Regular caching
                cache.put(request, responseClone);
            }
        }
        
        return response;
    } catch (error) {
        console.error('Fetch failed:', error);
        throw error;
    }
}

// 📱 التعامل مع رسائل من التطبيق
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Handle cache clearing
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('🗑️ تم مسح الكاش');
        });
    }
    
    // Pre-cache specific images
    if (event.data && event.data.type === 'CACHE_IMAGE') {
        caches.open(CACHE_NAME).then(cache => {
            cache.add(event.data.url);
        });
    }
});

// Periodic cache cleanup (every 24 hours)
setInterval(() => {
    caches.open(CACHE_NAME).then(cache => {
        cache.keys().then(keys => {
            const now = Date.now();
            const DAY = 24 * 60 * 60 * 1000;
            
            keys.forEach(request => {
                cache.match(request).then(response => {
                    if (response) {
                        const dateHeader = response.headers.get('date');
                        if (dateHeader) {
                            const responseDate = new Date(dateHeader).getTime();
                            if (now - responseDate > DAY) {
                                cache.delete(request);
                            }
                        }
                    }
                });
            });
        });
    });
}, 60 * 60 * 1000); // Check every hour

console.log('🐝 Pollinations AI Service Worker جاهز!');