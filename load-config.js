// load-config.js — мгновенная и надёжная загрузка конфигурации Supabase
(function () {
  console.log('🚀 Инициализация конфигурации Edu Keys...');

  // ---- Настройки кэша ----
  const CACHE_KEY_DATA = 'edu-keys-config';
  const CACHE_KEY_TIME = 'edu-keys-config-time';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа
  const now = Date.now();

  // ---- АКТУАЛЬНЫЕ ЗНАЧЕНИЯ ----
  const FALLBACK_CONFIG = {
    SUPABASE_URL: 'https://zjvedphdbpuzqzvznqex.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdmVkcGhkYnB1enF6dnpucWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDMxMDgsImV4cCI6MjA3NTkxOTEwOH0.rfIdcmTx9q-UZyQp0QKjBdGQGbDpMuy0R3_3P_DOV7I',
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
    window.dispatchEvent(new CustomEvent('configLoaded', {
      detail: {
        source: window.__EDU_KEYS_CONFIG_SOURCE__ || 'unknown',
        SUPABASE_URL: window.SUPABASE_URL,
      },
    }));
    
    // Дополнительно Promise для удобства
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

  // ---- ОСНОВНАЯ ЛОГИКА (упрощенная) ----
  
  // 1. Сначала пытаемся взять из кэша
  const cached = readFromCache();
  if (isValidConfig(cached)) {
    applyConfig(cached, 'cache');
  } else {
    // 2. Если нет в кэше или кэш устарел - используем fallback
    applyConfig(FALLBACK_CONFIG, 'fallback');
    saveToCache(FALLBACK_CONFIG);
  }

  // ---- 3. НЕ пытаемся загружать /config.js или /api/config ----
  // Эти запросы вызывают 404 ошибки, просто пропускаем их
  
  console.log('🚀 Конфигурация загружена успешно');

  // ---- Автопроверка спустя 100 мс ----
  setTimeout(() => {
    if (!window.checkConfig()) {
      console.error('❌ Критично: конфигурация Supabase не загружена!');
      // Если всё плохо, принудительно устанавливаем
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        window.SUPABASE_URL = FALLBACK_CONFIG.SUPABASE_URL;
        window.SUPABASE_ANON_KEY = FALLBACK_CONFIG.SUPABASE_ANON_KEY;
        dispatchReady();
      }
    } else {
      console.log('✅ Конфигурация успешно загружена из:', window.__EDU_KEYS_CONFIG_SOURCE__);
    }
  }, 100);
})();