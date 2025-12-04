// API endpoint для обработки callback query от Telegram Game
// Когда пользователь нажимает кнопку игры, Telegram отправляет callback query
// Этот endpoint обрабатывает его и возвращает URL игры

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Telegram отправляет callback query в формате:
    // {
    //   "callback_query": {
    //     "id": "...",
    //     "from": {...},
    //     "message": {...},
    //     "game_short_name": "krestiki_noliki"
    //   }
    // }

    const { callback_query } = req.body;

    if (!callback_query || !callback_query.game_short_name) {
        return res.status(400).json({ error: 'Invalid callback query' });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
        console.error('BOT_TOKEN is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const userId = callback_query.from.id;
        const chatId = callback_query.message?.chat?.id;
        const messageId = callback_query.message?.message_id;
        const callbackQueryId = callback_query.id;

        // Формируем URL игры с параметрами
        const gameUrl = `${process.env.GAME_URL || 'https://your-app.vercel.app'}?user_id=${userId}&chat_id=${chatId}&message_id=${messageId}`;

        // Отвечаем на callback query с URL игры
        const telegramUrl = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                url: gameUrl
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Telegram API error:', data);
            return res.status(response.status).json({ error: data.description || 'Telegram API error' });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error handling game callback:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

