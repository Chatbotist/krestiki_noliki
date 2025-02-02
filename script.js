const Telegram = window.Telegram.WebApp;

// Инициализация Telegram Mini App
Telegram.ready();
Telegram.expand();
Telegram.requestFullscreen();
Telegram.disableVerticalSwipes();
Telegram.lockOrientation("portrait");
Telegram.enableClosingConfirmation();

const vibrate = () => {
    if ('vibrate' in navigator) {
        navigator.vibrate(30);
    }
};

const elements = {
    board: document.getElementById('board'),
    cells: document.querySelectorAll('.cell'),
    scoreX: document.getElementById('scoreX'),
    scoreO: document.getElementById('scoreO')
};

let gameState = {
    board: ['', '', '', '', '', '', '', '', ''],
    currentPlayer: 'X',
    score: { X: 0, O: 0 },
    gameActive: true,
    winner: null
};

const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

const initializeGame = () => {
    gameState.board.fill('');
    gameState.gameActive = true;
    gameState.winner = null;
    elements.cells.forEach(cell => {
        cell.innerHTML = '';
        cell.style.pointerEvents = 'auto';
        cell.classList.remove('winning-cell', 'X', 'O');
    });
    Telegram.MainButton.hide();
};

const handleMove = (index) => {
    if (!gameState.gameActive || gameState.board[index]) return;

    vibrate();
    gameState.board[index] = gameState.currentPlayer;
    const icon = gameState.currentPlayer === 'X' 
        ? '<i class="fas fa-times"></i>' 
        : '<i class="far fa-circle"></i>';
    
    elements.cells[index].innerHTML = icon;
    elements.cells[index].classList.add(gameState.currentPlayer);

    checkResult();
};

const checkResult = () => {
    if (checkWin(gameState.currentPlayer)) {
        gameState.winner = gameState.currentPlayer;
        gameState.score[gameState.currentPlayer]++;
        updateScore();
        highlightWin();
        endGame(`Игрок ${gameState.currentPlayer} выиграл!`);
    } else if (gameState.board.every(cell => cell)) {
        gameState.winner = 'draw';
        endGame('Ничья!');
    } else {
        gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    }
};

const checkWin = (player) => {
    return winningCombinations.some(combination => 
        combination.every(index => gameState.board[index] === player)
    );
};

const highlightWin = () => {
    winningCombinations.forEach(combo => {
        if (combo.every(index => gameState.board[index] === gameState.currentPlayer)) {
            combo.forEach(index => elements.cells[index].classList.add('winning-cell'));
        }
    });
};

const endGame = (message) => {
    gameState.gameActive = false;
    elements.cells.forEach(cell => cell.style.pointerEvents = 'none');
    
    // Настройка кнопки в зависимости от результата
    let buttonColor = '#4CAF50'; // Зеленый по умолчанию для ничьи
    if (gameState.winner === 'X') buttonColor = '#2196F3';
    if (gameState.winner === 'O') buttonColor = '#f44336';

    Telegram.MainButton
        .setParams({
            color: buttonColor,
            text_color: '#ffffff',
            text: 'Новая игра'
        })
        .show()
        .onClick(() => {
            initializeGame();
            Telegram.MainButton.hide();
        });

    Telegram.showAlert(message, () => {});
};

const updateScore = () => {
    elements.scoreX.textContent = gameState.score.X;
    elements.scoreO.textContent = gameState.score.O;
};

// Event Listeners
elements.board.addEventListener('click', (e) => {
    const cellContainer = e.target.closest('.cell-container');
    if (cellContainer) {
        handleMove(cellContainer.dataset.index);
    }
});

// Инициализация при загрузке
initializeGame();
