// load-config.js — мгновенная и надёжная загрузка конфигурации Supabase
// ⚠️ Файл должен называться ИМЕННО load-config.js (не .html, не опечатки).
(function () {
  console.log('🚀 Инициализация конфигурации Edu Keys...');

  // ---- Настройки кэша ----
  const CACHE_KEY_DATA = 'edu-keys-config';
  const CACHE_KEY_TIME = 'edu-keys-config-time';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
  const now = Date.now();

  // ---- Значения по умолчанию (резерв) ----
  const FALLBACK_CONFIG = {
    SUPABASE_URL: 'https://zjvedphdbpuzqzvznqex.supabase.co',
    SUPABASE_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdmVkcGhkYnB1enF6dnpucWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDMxMDgsImV4cCI6MjA3NTkxOTEwOH0.rfIdcmTx9q-UZyQp0QKjBdGQGbDpMuy0R3_3P_DOV7I',
  };

  // ---- Утилиты ----
  function saveToCache(config) {
    try {
      localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(config));
      localStorage.setItem(CACHE_KEY_TIME, String(now));
      console.log('💾 Конфигурация сохранена в кэш');
    } catch (e) {
      console.warn('⚠️ Не удалось сохранить в кэш:', e.message);
    }
  }

  function readFromCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY_DATA);
      const ts = Number(localStorage.getItem(CACHE_KEY_TIME) || '0');
      if (!raw || !ts) return null;
      if (now - ts > CACHE_TTL_MS) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applyConfig(config, source) {
    window.SUPABASE_URL = config.SUPABASE_URL;
    window.SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
    window.__EDU_KEYS_CONFIG_SOURCE__ = source;
    console.log(`✅ Конфигурация установлена (${source})`);
    dispatchReady();
  }

  function isValidConfig(cfg) {
    return !!(cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  }

  function dispatchReady() {
    // Событие совместимо с уже подключённым кодом
    window.dispatchEvent(
      new CustomEvent('configLoaded', {
        detail: {
          source: window.__EDU_KEYS_CONFIG_SOURCE__ || 'unknown',
          SUPABASE_URL: window.SUPABASE_URL,
        },
      })
    );
    // Дополнительно Promise для удобства (необязательно)
    if (!window.CONFIG_READY_RESOLVED) {
      window.CONFIG_READY_RESOLVED = true;
      if (typeof window.__CONFIG_READY_RESOLVE__ === 'function') {
        window.__CONFIG_READY_RESOLVE__();
      }
    }
  }

  // Глобальная проверка
  window.checkConfig = function () {
    const ok = isValidConfig({
      SUPABASE_URL: window.SUPABASE_URL,
      SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY,
    });
    console.log('🔧 Проверка конфигурации:', {
      SUPABASE_URL: window.SUPABASE_URL ? '✅' : '❌',
      SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY ? '✅' : '❌',
      valid: ok,
      source: window.__EDU_KEYS_CONFIG_SOURCE__ || '—',
    });
    return ok;
  };

  // Promise: window.CONFIG_READY
  if (!window.CONFIG_READY) {
    window.CONFIG_READY = new Promise((resolve) => {
      window.__CONFIG_READY_RESOLVE__ = resolve;
    });
  }

  // ---- 1) Пытаемся взять из кэша максимально быстро ----
  const cached = readFromCache();
  if (isValidConfig(cached)) {
    applyConfig(cached, 'cache');
  }

  // ---- 2) Резерв: применяем FALLBACK мгновенно, если ещё ничего нет ----
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    applyConfig(FALLBACK_CONFIG, 'fallback');
    // Сразу кладём в кэш, чтобы первая загрузка страниц уже работала
    saveToCache(FALLBACK_CONFIG);
  }

  // ---- 3) Пробуем статический /config.js, если он существует ----
  // Он может переопределить значения (например, для Vercel env)
  (function tryStaticConfig() {
    const script = document.createElement('script');
    script.src = '/config.js?' + Date.now(); // избегаем кэша
    script.async = true;
    script.onload = function () {
      if (isValidConfig({ SUPABASE_URL: window.SUPABASE_URL, SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY })) {
        saveToCache({
          SUPABASE_URL: window.SUPABASE_URL,
          SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY,
        });
        window.__EDU_KEYS_CONFIG_SOURCE__ = 'static';
        dispatchReady();
        console.log('📦 Статический config.js применён');
      }
    };
    script.onerror = function () {
      console.log('ℹ️ Статический /config.js недоступен');
    };
    document.head.appendChild(script);
  })();

  // ---- 4) Пробуем API /api/config (Node) ----
  // Если отдаёт код, который выставляет глобальные переменные — применим и тоже закэшируем.
  fetch('/api/config', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('API config not available');
      return res.text();
    })
    .then((code) => {
      try {
        const before = { url: window.SUPABASE_URL, key: window.SUPABASE_ANON_KEY };
        // Выполняем код, который должен выставить window.SUPABASE_URL и window.SUPABASE_ANON_KEY
        // Внимание: этот код должен быть доверенным (ваш API).
        // eslint-disable-next-line no-eval
        eval(code);
        const after = { url: window.SUPABASE_URL, key: window.SUPABASE_ANON_KEY };
        if (after.url !== before.url || after.key !== before.key) {
          if (isValidConfig(after)) {
            saveToCache({ SUPABASE_URL: after.url, SUPABASE_ANON_KEY: after.key });
            applyConfig({ SUPABASE_URL: after.url, SUPABASE_ANON_KEY: after.key }, 'api');
            console.log('🔄 Конфигурация обновлена из API');
          }
        }
      } catch (e) {
        console.warn('API config evaluation failed:', e.message);
      }
    })
    .catch((e) => {
      console.log('ℹ️ /api/config недоступен:', e.message);
    });

  // ---- 5) Автопроверка спустя 100 мс ----
  setTimeout(() => {
    if (!window.checkConfig()) {
      console.error('❌ Критично: конфигурация Supabase не загружена!');
    } else {
      console.log('✅ Конфигурация успешно загружена из:', window.__EDU_KEYS_CONFIG_SOURCE__);
    }
  }, 100);
})();
