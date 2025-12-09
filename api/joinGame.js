// API endpoint для присоединения к игровой сессии

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { gameId, userId, userName } = req.body;

    if (!gameId || !userId) {
        return res.status(400).json({ error: 'gameId and userId are required' });
    }

    if (!global.gameSessions) {
        return res.status(404).json({ error: 'Game not found' });
    }

    const gameSession = global.gameSessions.get(gameId);

    if (!gameSession) {
        return res.status(404).json({ error: 'Game not found' });
    }

    if (gameSession.player2) {
        return res.status(400).json({ error: 'Game is already full' });
    }

    if (gameSession.player1.userId === userId) {
        return res.status(400).json({ error: 'You cannot join your own game' });
    }

    // Добавляем второго игрока
    gameSession.player2 = {
        userId,
        userName: userName || `Player_${userId}`,
        symbol: 'O'
    };
    gameSession.gameActive = true;
    gameSession.currentPlayer = 'X'; // Первый игрок начинает

    global.gameSessions.set(gameId, gameSession);

    return res.status(200).json({
        success: true,
        gameSession: {
            gameId,
            player1: gameSession.player1,
            player2: gameSession.player2,
            board: gameSession.board,
            currentPlayer: gameSession.currentPlayer,
            gameActive: gameSession.gameActive
        }
    });
}



