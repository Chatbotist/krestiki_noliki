// API endpoint для получения текущего состояния игры

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { gameId, userId } = req.query;

    if (!gameId) {
        return res.status(400).json({ error: 'gameId is required' });
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

    if (!isPlayer1 && !isPlayer2 && userId) {
        return res.status(403).json({ error: 'You are not a player in this game' });
    }

    return res.status(200).json({
        success: true,
        gameSession: {
            gameId,
            player1: gameSession.player1,
            player2: gameSession.player2,
            board: gameSession.board,
            currentPlayer: gameSession.currentPlayer,
            gameActive: gameSession.gameActive,
            winner: gameSession.winner,
            lastMove: gameSession.lastMove
        }
    });
}

