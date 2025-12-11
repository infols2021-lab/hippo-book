// load-config.js - упрощенная версия
(function () {
  console.log('🚀 Инициализация конфигурации...');
  
  // АБСОЛЮТНЫЕ КЛЮЧИ (всегда работают)
  window.SUPABASE_URL = 'https://zjvedphdbpuzqzvznqex.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqdmVkcGhkYnB1enF6dnpucWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNDMxMDgsImV4cCI6MjA3NTkxOTEwOH0.rfIdcmTx9q-UZyQp0QKjBdGQGbDpMuy0R3_3P_DOV7I';
  
  console.log('✅ Конфигурация установлена напрямую');
  
  // Отправляем событие что конфиг загружен
  window.dispatchEvent(new CustomEvent('configLoaded'));
  
  console.log('🔧 Проверка:', {
    SUPABASE_URL: window.SUPABASE_URL ? '✅' : '❌',
    SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY ? '✅' : '❌'
  });
})();