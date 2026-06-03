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
    // Загружаем скрипт Яндекса, если ещё не загружен
    if (!document.querySelector('#yandex-captcha-script')) {
      const script = document.createElement('script');
      script.id = 'yandex-captcha-script';
      script.src = 'https://captcha-api.yandex.ru/captcha.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Ждём появления window.ym
    const checkInterval = setInterval(() => {
      if (window.ym && containerRef.current && !initializedRef.current) {
        clearInterval(checkInterval);
        initializedRef.current = true;

        // Очищаем контейнер
        containerRef.current.innerHTML = '';

        // Инициализируем капчу
        try {
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
        } catch (err) {
          console.error('Yandex Captcha init error:', err);
          onToken(null);
        }
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [siteKey, onToken]);

  // Перезагрузка капчи при изменении reloadNonce
  useEffect(() => {
    if (initializedRef.current && containerRef.current) {
      // Удаляем старый виджет и пересоздаём
      containerRef.current.innerHTML = '';
      initializedRef.current = false;
      // Заново инициализируем через небольшой таймаут
      setTimeout(() => {
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
    }
  }, [reloadNonce, siteKey, onToken]);

  return (
    <div style={{ marginTop: 10 }}>
      <div ref={containerRef} />
    </div>
  );
}