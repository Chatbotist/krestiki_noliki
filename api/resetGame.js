// API endpoint для сброса игры (новая игра в той же сессии)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { gameId, userId } = req.body;

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

    // Проверяем, что пользователь является игроком
    const isPlayer1 = gameSession.player1.userId === userId;
    const isPlayer2 = gameSession.player2 && gameSession.player2.userId === userId;

    if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ error: 'You are not a player in this game' });
    }

    // Сбрасываем игру
    gameSession.board = ['', '', '', '', '', '', '', '', ''];
    gameSession.currentPlayer = 'X';
    gameSession.gameActive = true;
    gameSession.winner = null;
    gameSession.lastMove = null;

    global.gameSessions.set(gameId, gameSession);

    return res.status(200).json({
        success: true,
        gameSession: {
            gameId,
            board: gameSession.board,
            currentPlayer: gameSession.currentPlayer,
            gameActive: gameSession.gameActive,
            winner: gameSession.winner
        }
    });
}

