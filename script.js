// Проверка наличия Telegram WebApp API и создание fallback
const isTelegramWebApp = window.Telegram && window.Telegram.WebApp;
const Telegram = isTelegramWebApp ? window.Telegram.WebApp : {
    ready: () => {},
    expand: () => {},
    requestFullscreen: () => {},
    disableVerticalSwipes: () => {},
    lockOrientation: () => {},
    enableClosingConfirmation: () => {},
    MainButton: {
        hide: () => {},
        show: () => ({ setParams: () => ({ onClick: () => {} }) }),
        setParams: () => ({ show: () => ({ onClick: () => {} }) }),
        onClick: () => {}
    },
    showAlert: (message, callback) => {
        alert(message);
        if (callback) callback();
    },
    initDataUnsafe: {}
};

// Инициализация Telegram Mini App (только если доступно)
if (isTelegramWebApp) {
    Telegram.ready();
    Telegram.expand();
    Telegram.requestFullscreen();
    Telegram.disableVerticalSwipes();
    Telegram.lockOrientation("portrait");
    Telegram.enableClosingConfirmation();
}

// Получение параметров из URL для Telegram Game
const urlParams = new URLSearchParams(window.location.search);
const gameParams = {
    userId: urlParams.get('user_id') || Telegram.initDataUnsafe?.user?.id,
    chatId: urlParams.get('chat_id'),
    messageId: urlParams.get('message_id'),
    inlineMessageId: urlParams.get('inline_message_id')
};

// Проверка, запущена ли игра как Telegram Game
const isTelegramGame = !!(gameParams.userId && (gameParams.chatId || gameParams.inlineMessageId));

const vibrate = () => {
    if ('vibrate' in navigator) {
        navigator.vibrate(30);
    }
};

// Инициализация элементов после загрузки DOM
let elements = {
    board: null,
    cells: null,
    scoreX: null,
    scoreO: null
};

const initElements = () => {
    elements.board = document.getElementById('board');
    elements.cells = document.querySelectorAll('.cell');
    elements.scoreX = document.getElementById('scoreX');
    elements.scoreO = document.getElementById('scoreO');
};

let gameState = {
    board: ['', '', '', '', '', '', '', '', ''],
    currentPlayer: 'X',
    score: { X: 0, O: 0 },
    gameActive: true,
    winner: null,
    totalWins: 0, // Общее количество побед для отправки в Telegram
    isPlayerX: true // Игрок играет за X
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
    gameState.currentPlayer = 'X';
    
    if (elements.cells) {
        elements.cells.forEach(cell => {
            cell.innerHTML = '';
            cell.style.pointerEvents = 'auto';
            cell.classList.remove('winning-cell', 'X', 'O');
        });
    }
    
    // Также очищаем cell-container
    const cellContainers = document.querySelectorAll('.cell-container');
    cellContainers.forEach(container => {
        container.style.pointerEvents = 'auto';
    });
    
    if (isTelegramWebApp) {
        Telegram.MainButton.hide();
    } else {
        // Скрываем кнопку "Новая игра" для обычного браузера
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.style.display = 'none';
        }
    }
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
        
        // Для Telegram Game: игрок всегда играет за X, отправляем счет только при победе X
        if (isTelegramGame && gameState.currentPlayer === 'X') {
            gameState.totalWins++;
            sendGameScore(gameState.totalWins);
        }
        
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
    
    // Отключаем клики на всех ячейках
    if (elements.cells) {
        elements.cells.forEach(cell => cell.style.pointerEvents = 'none');
    }
    const cellContainers = document.querySelectorAll('.cell-container');
    cellContainers.forEach(container => {
        container.style.pointerEvents = 'none';
    });
    
    if (isTelegramWebApp) {
        // Настройка кнопки в зависимости от результата для Telegram
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
    } else {
        // Для обычного браузера показываем кнопку "Новая игра"
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.style.display = 'block';
            // Обновляем цвет кнопки в зависимости от результата
            if (gameState.winner === 'X') {
                newGameBtn.style.backgroundColor = '#2196F3';
            } else if (gameState.winner === 'O') {
                newGameBtn.style.backgroundColor = '#f44336';
            } else {
                newGameBtn.style.backgroundColor = '#4CAF50';
            }
        }
        alert(message);
    }
};

const updateScore = () => {
    elements.scoreX.textContent = gameState.score.X;
    elements.scoreO.textContent = gameState.score.O;
};

// Отправка результата игры в Telegram
const sendGameScore = async (score) => {
    if (!isTelegramGame) return;
    
    try {
        const response = await fetch('/api/setGameScore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: gameParams.userId,
                chatId: gameParams.chatId,
                messageId: gameParams.messageId,
                inlineMessageId: gameParams.inlineMessageId,
                score: score
            })
        });
        
        if (!response.ok) {
            console.error('Failed to send game score');
        }
    } catch (error) {
        console.error('Error sending game score:', error);
    }
};

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем элементы
    initElements();
    
    // Проверяем, что элементы найдены
    if (!elements.board) {
        console.error('Board element not found!');
        return;
    }
    
    // Event Listeners для игрового поля
    elements.board.addEventListener('click', (e) => {
        // Ищем ближайший cell-container
        const cellContainer = e.target.closest('.cell-container');
        if (cellContainer && cellContainer.dataset.index !== undefined) {
            const index = parseInt(cellContainer.dataset.index);
            handleMove(index);
        }
    });
    
    // Обработчик кнопки "Новая игра" для обычного браузера
    const newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            initializeGame();
        });
    }
    
    // Инициализация игры
    initializeGame();
});
