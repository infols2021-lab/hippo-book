// components/prodamus/ProdamusWidgetScript.tsx
"use client";

import Script from "next/script";

const PRODAMUS_INIT_SCRIPT = "https://widget.prodamus.ru/src/init.js";
const PRODAMUS_INIT_CSS = "https://widget.prodamus.ru/src/init.css";

/**
 * Подключает официальный платёжный виджет Продамуса (pop-up).
 *
 * Скрипт init.js открывает глобальную функцию window.payformInit, которую
 * вызывает RequestsClient при клике на «Перейти к оплате». Стили init.css
 * подключаются через <link> — React поднимает их в <head> документа.
 */
export default function ProdamusWidgetScript() {
  return (
    <>
      <link rel="stylesheet" href={PRODAMUS_INIT_CSS} />
      <Script
        id="prodamus-init-script"
        src={PRODAMUS_INIT_SCRIPT}
        strategy="afterInteractive"
      />
    </>
  );
}

