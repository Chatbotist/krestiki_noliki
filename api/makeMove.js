// API endpoint для отправки хода в игре

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { gameId, userId, cellIndex } = req.body;

    if (!gameId || !userId || cellIndex === undefined) {
        return res.status(400).json({ error: 'gameId, userId, and cellIndex are required' });
    }

    if (!global.gameSessions) {
        return res.status(404).json({ error: 'Game not found' });
    }

    const gameSession = global.gameSessions.get(gameId);

    if (!gameSession) {
        return res.status(404).json({ error: 'Game not found' });
    }

    if (!gameSession.gameActive) {
        return res.status(400).json({ error: 'Game is not active' });
    }

    // Проверяем, что это ход правильного игрока
    const isPlayer1 = gameSession.player1.userId === userId;
    const isPlayer2 = gameSession.player2 && gameSession.player2.userId === userId;

    if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ error: 'You are not a player in this game' });
    }

    const playerSymbol = isPlayer1 ? 'X' : 'O';

    // Проверяем, что сейчас ход этого игрока
    if (gameSession.currentPlayer !== playerSymbol) {
        return res.status(400).json({ error: 'Not your turn' });
    }

    // Проверяем, что ячейка свободна
    if (gameSession.board[cellIndex] !== '') {
        return res.status(400).json({ error: 'Cell is already occupied' });
    }

    // Делаем ход
    gameSession.board[cellIndex] = playerSymbol;
    gameSession.currentPlayer = playerSymbol === 'X' ? 'O' : 'X';
    gameSession.lastMove = {
        cellIndex,
        player: playerSymbol,
        timestamp: Date.now()
    };

    // Проверяем победу
    const winner = checkWinner(gameSession.board, playerSymbol);
    if (winner) {
        gameSession.winner = winner;
        gameSession.gameActive = false;
    } else if (gameSession.board.every(cell => cell !== '')) {
        // Ничья
        gameSession.winner = 'draw';
        gameSession.gameActive = false;
    }

    global.gameSessions.set(gameId, gameSession);

    return res.status(200).json({
        success: true,
        gameSession: {
            gameId,
            board: gameSession.board,
            currentPlayer: gameSession.currentPlayer,
            gameActive: gameSession.gameActive,
            winner: gameSession.winner,
            lastMove: gameSession.lastMove
        }
    });
}

// Функция проверки победы
function checkWinner(board, player) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    return winningCombinations.some(combination =>
        combination.every(index => board[index] === player)
    ) ? player : null;
}



