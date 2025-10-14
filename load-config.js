// load-config.js - мгновенная загрузка с полной логикой
(function() {
    console.log('🚀 Загружаем конфигурацию (полная версия)...');
    
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа
    const now = Date.now();

    // Функция для сохранения в кэш
    function saveToCache(config) {
        try {
            localStorage.setItem('edu-keys-config', JSON.stringify(config));
            localStorage.setItem('edu-keys-config-time', now.toString());
            console.log('✅ Конфигурация сохранена в кэш');
        } catch (e) {
            console.warn('Не удалось сохранить в кэш:', e.message);
        }
    }

    // Функция для установки конфигурации и отправки события
    function setConfig(config, source) {
        window.SUPABASE_URL = config.SUPABASE_URL;
        window.SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
        console.log(`✅ Конфигурация загружена из: ${source}`);
        window.dispatchEvent(new CustomEvent('configLoaded', { 
            detail: { source, config }
        }));
    }

    // Источник 1: Кэш localStorage (самый быстрый)
    try {
        const cachedConfig = localStorage.getItem('edu-keys-config');
        const cacheTime = localStorage.getItem('edu-keys-config-time');
        
        if (cachedConfig && cacheTime && (now - parseInt(cacheTime)) < CACHE_DURATION) {
            const config = JSON.parse(cachedConfig);
            setConfig(config, 'cache');
        }
    } catch (e) {
        console.warn('Ошибка чтения кэша:', e.message);
    }

    // Источник 2: Резервные значения (мгновенно)
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        const fallbackConfig = {
            SUPABASE_URL: 'https://dtjhlanmwjpdcdxgzzyo.supabase.co',
            SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0amhsYW5td2pwZGNkeGd6enlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDUwOTIsImV4cCI6MjA3MjM4MTA5Mn0.jS4DXQSOBawRFtnzjsmF5AzzltDYAG0AXrwrY1B0UpY'
        };
        setConfig(fallbackConfig, 'fallback');
        saveToCache(fallbackConfig);
    }

    // Параллельно проверяем другие источники (в фоне)
    
    // Источник 3: Глобальные переменные (если есть)
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && 
        !localStorage.getItem('config-checked-globals')) {
        const globalConfig = {
            SUPABASE_URL: window.SUPABASE_URL,
            SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY
        };
        setConfig(globalConfig, 'globals');
        saveToCache(globalConfig);
        localStorage.setItem('config-checked-globals', 'true');
    }

    // Источник 4: API endpoint
    fetch('/api/config')
        .then(response => {
            if (!response.ok) throw new Error('API not available');
            return response.text();
        })
        .then(jsCode => {
            // Безопасное выполнение кода API
            try {
                const originalURL = window.SUPABASE_URL;
                const originalKEY = window.SUPABASE_ANON_KEY;
                
                eval(jsCode);
                
                // Проверяем, изменились ли значения
                if (window.SUPABASE_URL !== originalURL || window.SUPABASE_ANON_KEY !== originalKEY) {
                    const apiConfig = {
                        SUPABASE_URL: window.SUPABASE_URL,
                        SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY
                    };
                    setConfig(apiConfig, 'api');
                    saveToCache(apiConfig);
                    console.log('✅ Конфигурация обновлена из API');
                }
            } catch (error) {
                console.log('API config evaluation failed:', error.message);
            }
        })
        .catch(error => {
            console.log('API config not available:', error.message);
        });

    // Источник 5: Статический config.js
    if (!window.configStaticLoaded) {
        const script = document.createElement('script');
        script.src = '/config.js?' + Date.now(); // Добавляем timestamp для избежания кэша
        script.onload = function() {
            if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
                const staticConfig = {
                    SUPABASE_URL: window.SUPABASE_URL,
                    SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY
                };
                setConfig(staticConfig, 'static');
                saveToCache(staticConfig);
                console.log('✅ Конфигурация загружена из static config');
            }
            window.configStaticLoaded = true;
        };
        script.onerror = function() {
            console.log('Static config not available');
            window.configStaticLoaded = true;
        };
        document.head.appendChild(script);
    }

    // Функция для проверки конфигурации (как в оригинале)
    window.checkConfig = function() {
        const configValid = window.SUPABASE_URL && window.SUPABASE_ANON_KEY;
        console.log('🔧 Configuration check:', {
            SUPABASE_URL: window.SUPABASE_URL ? '✅' : '❌',
            SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY ? '✅' : '❌',
            valid: configValid
        });
        return configValid;
    };

    // Автопроверка при загрузке
    setTimeout(() => {
        if (!window.checkConfig()) {
            console.error('❌ Critical: Supabase configuration is missing!');
        } else {
            console.log('✅ Configuration loaded successfully!');
        }
    }, 100);

})();