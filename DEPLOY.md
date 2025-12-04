# Инструкция по деплою

## Шаг 1: Деплой бэкенда на Render

1. Зайдите на [render.com](https://render.com) и создайте аккаунт
2. Нажмите "New +" → "Web Service"
3. Подключите ваш GitHub репозиторий
4. Настройки:
   - **Name**: `krestiki-noliki-backend` (или любое другое)
   - **Environment**: `Python 3`
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free (или любой другой)

5. В разделе **Environment Variables** добавьте:
   - `FRONTEND_URL` = `https://krestiki-noliki-xpj9.vercel.app` (URL вашего фронтенда)

6. Нажмите "Create Web Service"
7. Дождитесь деплоя (может занять 2-3 минуты)
8. Скопируйте URL вашего сервиса (например: `https://krestiki-noliki-backend.onrender.com`)

## Шаг 2: Обновление фронтенда

1. Откройте файл `script.js`
2. Найдите строку:
   ```javascript
   const BACKEND_URL = 'https://your-backend.onrender.com';
   ```
3. Замените на URL вашего бэкенда с Render:
   ```javascript
   const BACKEND_URL = 'https://krestiki-noliki-backend.onrender.com';
   ```
4. Сохраните и закоммитьте изменения:
   ```bash
   git add script.js
   git commit -m "Update backend URL"
   git push origin main
   ```

## Шаг 3: Проверка работы

1. После деплоя фронтенда на Vercel, откройте игру
2. Нажмите "Создать игру"
3. Скопируйте ссылку-приглашение
4. Откройте ссылку в другом браузере/устройстве
5. Игра должна работать!

## Примечания

- Render может "засыпать" бесплатные сервисы после 15 минут неактивности
- Первый запрос после пробуждения может занять 30-50 секунд
- Для продакшена рекомендуется использовать платный план Render или другой хостинг

## Альтернатива: Использование переменной окружения

Вместо хардкода URL в `script.js`, можно использовать переменную окружения Vercel:

1. В настройках проекта Vercel добавьте переменную `NEXT_PUBLIC_BACKEND_URL`
2. В `script.js` используйте:
   ```javascript
   const BACKEND_URL = window.BACKEND_URL || 'https://your-backend.onrender.com';
   ```
3. В `index.html` добавьте перед `</head>`:
   ```html
   <script>
     window.BACKEND_URL = 'https://your-backend.onrender.com';
   </script>
   ```

