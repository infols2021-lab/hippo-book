// components/prodamus/ProdamusWidgetScript.tsx
"use client";

import { useState } from "react";
import Script from "next/script";

const PRODAMUS_WIDGET_PRIMARY = "https://faustova.payform.ru/widget.js";
const PRODAMUS_WIDGET_FALLBACK = "https://payform.ru/widget.js";

/**
 * Подключает скрипт платёжного виджета Продамуса (lazyOnload).
 *
 * Если основной домен магазина (faustova.payform.ru) недоступен/заблокирован —
 * автоматически подключаем общий fallback-домен payform.ru. После загрузки
 * скрипт открывает глобальные window.prodamusPay / window.PayformWidget,
 * которые использует RequestsClient при нажатии «Перейти к оплате».
 */
export default function ProdamusWidgetScript() {
  const [src, setSrc] = useState<string>(PRODAMUS_WIDGET_PRIMARY);

  return (
    <Script
      id="prodamus-widget-script"
      strategy="lazyOnload"
      src={src}
      onError={() =>
        setSrc((current) =>
          current === PRODAMUS_WIDGET_PRIMARY ? PRODAMUS_WIDGET_FALLBACK : current,
        )
      }
    />
  );
}
