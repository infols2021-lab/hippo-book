# Как сделать PDF-шаблон сертификата

Шаблон хранится в Yandex Object Storage, бакет: **hippo-book-certificates**.

Путь файла задаётся автоматически: `certificates/{materialId}/template.pdf`.

## 1. Размер и ориентация

- Формат: **A4 альбомная** (297 x 210 mm) — удобно для сертификата.
- В Figma/Canva/PowerPoint сделай макет, экспортируй в PDF.

## 2. Поля формы (это и есть «плейсхолдеры»)

В PDF нужны **Text Field** с **английскими именами** (без пробелов):

| Имя поля | Обычно подставляется |
|----------|----------------------|
| `student_name` | Имя ученика |
| `course_title` | Название курса |
| `issue_date` | Дата выдачи |
| `certificate_id` | Номер сертификата |
| `email` | Email (опционально) |

Имена могут быть любыми — в админке ты сам выберешь, что куда мапится.
Система автоматически узнаёт популярные имена (`student_name`, `full_name`, `date` и т.д.).

### Где добавить поля

**Adobe Acrobat Pro**
1. Tools → Prepare Form
2. Add Text Field
3. Properties → General → Name: `student_name`
4. Appearance: шрифт, размер, выравнивание по центру

**PDFescape / Sejda (онлайн)**
1. Upload PDF
2. Form Fields → Text
3. Задай имя поля в свойствах

**LibreOffice Draw**
1. Form → Design Mode
2. Insert Text Box → Control Properties → Name

## 3. Советы по дизайну

- Декоративный фон — **обычная графика** в PDF (не поле формы).
- Динамический текст — **только через поля формы**.
- Для кириллицы: при генерации подставляется шрифт Roboto — в макете лучше не использовать экзотические шрифты в полях.
- Размер поля с запасом: длинное имя должно помещаться.
- Выравнивание текста в поле — по центру для имени, по левому для длинных строк.

## 4. Загрузка в админке

1. Roadmap-материал → блок **Сертификат PDF**
2. Drag & drop PDF
3. Проверь список полей
4. Настрой маппинг (поле PDF → данные ученика)
5. **Тестовый PDF** — скачай и проверь
6. **Сохранить сертификат**

## 5. Fallback

Колонка Fallback — текст, если поле пустое (например, для имени: `Участник`).

## 6. Если поля не находятся

- PDF сохранён «как картинка» без формы — переделай с Text Fields.
- Поля не Text Field — используй именно текстовые поля формы.
- Экспорт из Figma без формы — добавь поля в Acrobat/Sejda поверх PDF.

## 7. Env (для DevOps)

```env
CERTIFICATE_BUCKET_NAME=hippo-book-certificates
YANDEX_ACCESS_KEY_ID=...
YANDEX_SECRET_ACCESS_KEY=...
YANDEX_REGION=ru-central1
```

Сервисный ключ Yandex Cloud должен иметь access read/write в бакет `hippo-book-certificates`.
