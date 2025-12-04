# Tic Tac Toe Multiplayer Backend

FastAPI бэкенд для многопользовательской игры в крестики-нолики.

## Деплой на Render

1. Создайте новый Web Service на Render
2. Подключите репозиторий GitHub
3. Настройки:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment**: Python 3
4. После деплоя скопируйте URL (например: `https://your-app.onrender.com`)
5. Обновите `BACKEND_URL` в `script.js` на фронтенде

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

