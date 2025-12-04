// API endpoint для отправки результатов игры в Telegram
// Токен бота должен быть установлен как переменная окружения BOT_TOKEN в Vercel

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, chatId, messageId, inlineMessageId, score } = req.body;

    if (!userId || !score) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
        console.error('BOT_TOKEN is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Формируем параметры для API Telegram
        const params = new URLSearchParams({
            user_id: userId,
            score: score.toString(),
            force: 'true' // Разрешаем обновление, даже если новый счет меньше
        });

        // Добавляем chat_id и message_id или inline_message_id
        if (inlineMessageId) {
            params.append('inline_message_id', inlineMessageId);
        } else if (chatId && messageId) {
            params.append('chat_id', chatId);
            params.append('message_id', messageId);
        } else {
            return res.status(400).json({ error: 'Either chat_id+message_id or inline_message_id required' });
        }

        // Отправляем запрос к Telegram Bot API
        const telegramUrl = `https://api.telegram.org/bot${botToken}/setGameScore?${params.toString()}`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Telegram API error:', data);
            return res.status(response.status).json({ error: data.description || 'Telegram API error' });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error setting game score:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

