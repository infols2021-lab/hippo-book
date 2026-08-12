// test-promo.js

// Поменяй на свой локальный или тестовый URL
const API_URL = "http://localhost:3000/api/promocodes/redeem"; 
const PROMO_CODE = "TEST_CODE_123";

// Сюда нужно вставить реальную куку авторизации тестового ученика, 
// иначе бэкенд не поймет, кому начислять награду
const AUTH_COOKIE = "sb-your-project-ref-auth-token=какая-то-длинная-строка"; 

async function spamPromo() {
  console.log(`🚀 Запускаем стресс-тест промокода: ${PROMO_CODE}`);

  // Формируем массив из 20 идентичных запросов
  const requests = Array.from({ length: 20 }).map(() =>
    fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": AUTH_COOKIE, 
      },
      body: JSON.stringify({ code: PROMO_CODE }),
    })
  );

  // Promise.all отправляет их параллельно, создавая ту самую "гонку" (race condition)
  const responses = await Promise.all(requests);

  let successCount = 0;
  let failCount = 0;

  for (const res of responses) {
    const data = await res.json().catch(() => ({}));
    // Проверяем, ответил ли бэкенд успехом
    if (res.ok && (data.ok || data.success)) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log("--- РЕЗУЛЬТАТЫ ---");
  console.log(`✅ Успешных активаций: ${successCount} (В идеале должна быть 1)`);
  console.log(`❌ Отклоненных запросов (уже использован/ошибка): ${failCount}`);

  if (successCount > 1) {
    console.log("🚨 АЛАРМ! Уязвимость Race Condition подтверждена. Один код применился несколько раз.");
  } else {
    console.log("🛡️ Всё четко! База данных корректно блокирует параллельные активации.");
  }
}

spamPromo();