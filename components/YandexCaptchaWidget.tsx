"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    ym?: {
      init: (container: HTMLElement, params: {
        sitekey: string;
        theme?: 'light' | 'dark';
        hl?: string;
        callback?: (token: string) => void;
        'error-callback'?: () => void;
      }) => void;
    };
  }
}

type Props = {
  siteKey: string;
  reloadNonce: number;
  onToken: (token: string | null) => void;
};

export default function YandexCaptchaWidget({ siteKey, reloadNonce, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Убедимся, что контейнер существует
    if (!containerRef.current) return;

    // Функция инициализации капчи
    const initCaptcha = () => {
      if (!window.ym || !containerRef.current || initializedRef.current) return;
      try {
        // Очищаем контейнер перед инициализацией
        containerRef.current.innerHTML = '';
        window.ym.init(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          hl: 'ru',
          callback: (token: string) => {
            onToken(token);
          },
          'error-callback': () => {
            onToken(null);
          },
        });
        initializedRef.current = true;
      } catch (err) {
        console.error('Yandex Captcha init error:', err);
        onToken(null);
      }
    };

    // Загружаем скрипт, если ещё не загружен
    if (!document.querySelector('#yandex-captcha-script')) {
      const script = document.createElement('script');
      script.id = 'yandex-captcha-script';
      script.src = 'https://captcha-api.yandex.ru/captcha.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // После загрузки скрипта пробуем инициализировать
        initCaptcha();
      };
      script.onerror = () => {
        console.error('Failed to load Yandex Captcha script');
        onToken(null);
      };
      document.head.appendChild(script);
    } else {
      // Скрипт уже есть, инициализируем сразу
      initCaptcha();
    }

    // Очистка при размонтировании
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      initializedRef.current = false;
    };
    // Зависимость от siteKey и onToken, reloadNonce обрабатывается отдельно
  }, [siteKey, onToken]);

  // Перезагрузка капчи при изменении reloadNonce
  useEffect(() => {
    if (initializedRef.current && containerRef.current && window.ym) {
      // Сбрасываем флаг и очищаем контейнер
      initializedRef.current = false;
      containerRef.current.innerHTML = '';
      // Переинициализируем через таймаут
      const timer = setTimeout(() => {
        if (window.ym && containerRef.current && !initializedRef.current) {
          try {
            window.ym.init(containerRef.current, {
              sitekey: siteKey,
              theme: 'light',
              hl: 'ru',
              callback: (token: string) => onToken(token),
              'error-callback': () => onToken(null),
            });
            initializedRef.current = true;
          } catch (err) {
            console.error('Yandex Captcha reinit error:', err);
            onToken(null);
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [reloadNonce, siteKey, onToken]);

  return (
    <div style={{ marginTop: 10, minHeight: 80 }}>
      <div ref={containerRef} />
    </div>
  );
}