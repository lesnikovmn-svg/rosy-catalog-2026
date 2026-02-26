# rosy-catalog-2026

Каталог саженцев роз на весну 2026 — бесплатно на GitHub Pages (статический сайт) + Google Sheets/Apps Script (заказы и остатки).

Этот проект — статический каталог роз (HTML/CSS/JS) для GitHub Pages + бесплатный “бэкенд” на Google Sheets через Google Apps Script (без PHP/MySQL).

## Что работает

- Каталог с поиском/фильтрами/сортировкой
- Карточка товара
- Корзина (localStorage)
- Оформление заказа: отправка в Google Sheets + письмо на `lesnikovmn@gmail.com`
- Отзывы: отправка в Google Sheets (статус на модерацию)

## Быстрый старт (локально)

Откройте `index.html` через любой локальный сервер (желательно, чтобы работали модули/фетч):

```bash
python3 -m http.server 5173
```

Откройте: `http://localhost:5173/`

## Настройка Google Sheets + Apps Script

### 1) Создайте таблицу Google Sheets

Создайте Google Sheet и добавьте листы (вкладки) с названиями и колонками **в первой строке**:

**Products**

`id,slug,name,description,price_rub,currency,color,height_cm,bloom_type,is_active,is_new,popularity,image_url,updated_at`

Примечания:
- `image_url` можно оставить пустым — тогда сайт попробует взять локальное фото `images/<slug>-1.jpg` и, если не найдёт, покажет `images/placeholder.jpg`.

**Stock**

`product_id,quantity,low_stock_threshold,updated_at`

**Orders**

`order_id,created_at,status,customer_name,email,phone,address,comment,subtotal_rub,discount_rub,total_rub,items_json`

**OrderItems**

`order_id,product_id,product_name,price_rub,qty,line_total_rub`

**Reviews**

`review_id,created_at,status,product_id,author_name,author_email,rating,text`

Заполните несколько товаров (или начните с `data/products.sample.json` и потом перенесите в таблицу).

### 2) Подключите Apps Script

1. В таблице: `Расширения` → `Apps Script`.
2. Скопируйте содержимое `apps-script/Code.gs` в редактор.
3. Вверху файла настройте:
   - `OWNER_EMAIL` = `lesnikovmn@gmail.com`
4. Сохраните и запустите функцию `setupSheets()` один раз (создаст листы и заголовки).
5. `Развернуть` → `Новое развертывание` → `Веб‑приложение`:
   - Выполнять от имени: **вас**
   - Кто имеет доступ: **Все**
6. Скопируйте URL вида `https://script.google.com/macros/s/.../exec`.

### 3) Пропишите URL в проекте

Откройте `assets/js/config.js` и вставьте URL:

```js
export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```

## Публикация на GitHub Pages

1) Загрузите эти файлы в репозиторий `rosy-catalog-2026`.
2) В GitHub: Settings → Pages → Deploy from branch → `main` / root.

## Интеграция шаблона templatemo

Если у вас есть `templatemo_556_catalog_z`, замените разметку в `index.html`, `product.html`, `cart.html`, оставив подключения:

- `assets/js/config.js`
- `assets/js/app.js`
- `assets/js/cart.js`
