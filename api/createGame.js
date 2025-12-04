// API endpoint для создания новой игровой сессии
// Возвращает gameId для приглашения оппонента

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, userName } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    // Генерируем уникальный ID игры
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // В реальном приложении здесь бы использовалась база данных
    // Для простоты используем глобальную переменную (в продакшене нужна БД)
    // Сохраняем в памяти (в продакшене использовать Redis или БД)
    const gameSession = {
        gameId,
        player1: {
            userId,
            userName: userName || `Player_${userId}`,
            symbol: 'X'
        },
        player2: null,
        board: ['', '', '', '', '', '', '', '', ''],
        currentPlayer: 'X',
        gameActive: false, // Игра начинается когда присоединится второй игрок
        winner: null,
        createdAt: Date.now(),
        lastMove: null
    };

    // В реальном приложении сохраняем в БД
    // Для демо используем простой подход с глобальным хранилищем
    if (!global.gameSessions) {
        global.gameSessions = new Map();
    }
    global.gameSessions.set(gameId, gameSession);

    // Очищаем старые игры (старше 1 часа)
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, game] of global.gameSessions.entries()) {
        if (game.createdAt < oneHourAgo) {
            global.gameSessions.delete(id);
        }
    }

    const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : (process.env.GAME_URL || 'https://krestiki-noliki-xpj9.vercel.app');
    
    return res.status(200).json({
        success: true,
        gameId,
        inviteLink: `${baseUrl}/?gameId=${gameId}&player=2`
    });
}

