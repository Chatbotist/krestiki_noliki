# Tic Tac Toe Multiplayer Backend

FastAPI бэкенд для многопользовательской игры в крестики-нолики.

## Деплой на Render

1. Создайте новый Web Service на Render
2. Подключите репозиторий GitHub
3. **ВАЖНО: Настройки в Render:**
   - **Root Directory**: `backend` (обязательно!)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python Version**: `3.11` (в Environment Variables добавьте `PYTHON_VERSION=3.11.8`)
4. В разделе **Environment Variables** добавьте:
   - `FRONTEND_URL` = `https://krestiki-noliki-liard.vercel.app`
5. После деплоя скопируйте URL (например: `https://krestiki-noliki-ykec.onrender.com`)
6. URL уже настроен в `script.js` на фронтенде

**Если деплой зависает:**
- Проверьте, что Root Directory установлен в `backend`
- Убедитесь, что Python версия 3.11 (не 3.13)
- Проверьте логи деплоя - там будет видно, на каком этапе происходит таймаут

## API Endpoints

- `POST /api/createGame` - Создание новой игры
- `POST /api/joinGame` - Присоединение к игре
- `POST /api/makeMove` - Отправка хода
- `GET /api/getGameState` - Получение состояния игры
- `POST /api/resetGame` - Сброс игры для нового раунда
- `GET /health` - Проверка здоровья сервиса

## Локальный запуск

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Сервер запустится на `http://localhost:8000`

