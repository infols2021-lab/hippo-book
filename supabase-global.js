// supabase-global.js - глобальная загрузка Supabase для всех страниц
(function() {
  console.log('🔄 Глобальная загрузка Supabase...');
  
  const GLOBAL_SUPABASE_KEY = 'supabase-global-client';
  const CONFIG_KEY = 'supabase-global-config';
  
  // 1. Проверяем, есть ли уже загруженный клиент
  if (window[GLOBAL_SUPABASE_KEY]) {
    console.log('✅ Supabase уже загружен глобально');
    return;
  }
  
  // 2. Функция для создания клиента
  function createSupabaseClient() {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error('❌ Нет конфигурации Supabase');
      return null;
    }
    
    console.log('🔧 Создаем Supabase клиент...');
    
    // Пробуем разные методы загрузки
    try {
      // Метод 1: Используем глобальную библиотеку
      if (window.supabase && window.supabase.createClient) {
        console.log('✅ Используем глобальный supabase.createClient');
        return window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_ANON_KEY
        );
      }
      
      // Метод 2: Используем UMD загрузку
      if (typeof supabase !== 'undefined' && supabase.createClient) {
        console.log('✅ Используем UMD supabase');
        return supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_ANON_KEY
        );
      }
      
      console.error('❌ Библиотека Supabase не найдена');
      return null;
      
    } catch (error) {
      console.error('❌ Ошибка создания клиента:', error);
      return null;
    }
  }
  
  // 3. Основная функция загрузки
  function loadSupabase() {
    // Если конфигурация уже загружена, создаем клиент сразу
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      console.log('📦 Конфигурация найдена, создаем клиент...');
      const client = createSupabaseClient();
      if (client) {
        window[GLOBAL_SUPABASE_KEY] = client;
        window.dispatchEvent(new CustomEvent('supabaseReady', { detail: client }));
        console.log('✅ Supabase клиент создан глобально');
      }
      return;
    }
    
    // Иначе ждем загрузки конфигурации
    console.log('⏳ Ждем загрузки конфигурации...');
    
    window.addEventListener('configLoaded', function() {
      console.log('📦 Конфигурация загружена, создаем клиент...');
      const client = createSupabaseClient();
      if (client) {
        window[GLOBAL_SUPABASE_KEY] = client;
        window.dispatchEvent(new CustomEvent('supabaseReady', { detail: client }));
        console.log('✅ Supabase клиент создан глобально');
      }
    });
    
    // Таймаут на случай если событие не сработает
    setTimeout(() => {
      if (!window[GLOBAL_SUPABASE_KEY] && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        console.log('⏰ Таймаут: создаем клиент принудительно...');
        const client = createSupabaseClient();
        if (client) {
          window[GLOBAL_SUPABASE_KEY] = client;
          window.dispatchEvent(new CustomEvent('supabaseReady', { detail: client }));
        }
      }
    }, 3000);
  }
  
  // 4. Загружаем библиотеку Supabase если её нет
  function loadSupabaseLibrary() {
    // Если библиотека уже загружена
    if (window.supabase || (typeof supabase !== 'undefined')) {
      console.log('✅ Библиотека Supabase уже загружена');
      loadSupabase();
      return;
    }
    
    console.log('📚 Загружаем библиотеку Supabase...');
    
    // Загружаем через UMD (самый надежный способ)
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
    script.onload = function() {
      console.log('✅ Библиотека Supabase загружена');
      loadSupabase();
    };
    script.onerror = function() {
      console.error('❌ Не удалось загрузить библиотеку Supabase');
      // Пробуем альтернативный CDN
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://unpkg.com/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
      fallbackScript.onload = function() {
        console.log('✅ Библиотека Supabase загружена через fallback');
        loadSupabase();
      };
      document.head.appendChild(fallbackScript);
    };
    
    document.head.appendChild(script);
  }
  
  // 5. Инициализация
  loadSupabaseLibrary();
  
  // 6. Глобальные хелперы
  window.getSupabaseClient = function() {
    return window[GLOBAL_SUPABASE_KEY];
  };
  
  window.waitForSupabase = function(callback) {
    if (window[GLOBAL_SUPABASE_KEY]) {
      callback(window[GLOBAL_SUPABASE_KEY]);
    } else {
      window.addEventListener('supabaseReady', function(event) {
        callback(event.detail);
      });
    }
  };
  
  console.log('🚀 Глобальный загрузчик Supabase инициализирован');
})();