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

// Безопасная инициализация Telegram Mini App
if (isTelegramWebApp) {
    try {
        Telegram.ready();
        Telegram.expand();
        
        // Отключаем кнопку "Поделиться" и другие ненужные функции
        if (Telegram.disableClosingConfirmation) {
            Telegram.disableClosingConfirmation();
        }
        
        // Отключаем предложение поделиться
        if (Telegram.BackButton) {
            Telegram.BackButton.hide();
        }
        
    } catch (e) {
        console.warn('Telegram WebApp init error:', e);
    }
    
    // Безопасный вызов методов с проверкой поддержки
    const safeCall = (method, ...args) => {
        try {
            if (Telegram[method]) {
                Telegram[method](...args);
            }
        } catch (e) {
            console.warn(`Telegram method ${method} not supported:`, e);
        }
    };
    
    safeCall('requestFullscreen');
    safeCall('disableVerticalSwipes');
    safeCall('lockOrientation', 'portrait');
}

// Получение параметров из URL для Telegram Game и многопользовательской игры
const urlParams = new URLSearchParams(window.location.search);
const gameParams = {
    userId: urlParams.get('user_id') || Telegram.initDataUnsafe?.user?.id || `user_${Date.now()}`,
    chatId: urlParams.get('chat_id'),
    messageId: urlParams.get('message_id'),
    inlineMessageId: urlParams.get('inline_message_id'),
    gameId: urlParams.get('gameId'), // ID многопользовательской игры
    player: urlParams.get('player') // 1 или 2
};

// Проверка, запущена ли игра как Telegram Game
const isTelegramGame = !!(gameParams.userId && (gameParams.chatId || gameParams.inlineMessageId));

// Многопользовательский режим
let multiplayerState = {
    isMultiplayer: false,
    gameId: null,
    playerNumber: null, // 1 или 2
    mySymbol: null, // 'X' или 'O'
    opponentConnected: false,
    pollingInterval: null
};

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
        container.classList.remove('winning-cell');
    });
    
    if (isTelegramWebApp) {
        try {
            Telegram.MainButton.hide();
            // Очищаем обработчики при инициализации новой игры
            Telegram.MainButton.offClick();
        } catch (e) {
            console.warn('MainButton.hide error:', e);
        }
    } else {
        // В обычном браузере кнопка всегда видна и активна
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.textContent = 'Новая игра';
            newGameBtn.style.display = 'block';
            newGameBtn.style.backgroundColor = '#4CAF50';
            newGameBtn.disabled = false;
            newGameBtn.style.opacity = '1';
            newGameBtn.style.cursor = 'pointer';
        }
        updateCurrentPlayerIndicator();
    }
};

const handleMove = (index) => {
    if (!gameState.gameActive || gameState.board[index] || !elements.cells) return;

    vibrate();
    gameState.board[index] = gameState.currentPlayer;
    const icon = gameState.currentPlayer === 'X' 
        ? '<i class="fas fa-times"></i>' 
        : '<i class="far fa-circle"></i>';
    
    if (elements.cells[index]) {
        elements.cells[index].innerHTML = icon;
        elements.cells[index].classList.add(gameState.currentPlayer);
    }

    checkResult();
};

const checkResult = () => {
    if (checkWin(gameState.currentPlayer)) {
        gameState.winner = gameState.currentPlayer;
        gameState.score[gameState.currentPlayer]++;
        
        // Для Telegram Game: отправляем счет при любой победе (игра на двоих)
        if (isTelegramGame) {
            // Считаем общее количество побед для отправки в Telegram
            gameState.totalWins = Math.max(gameState.score.X, gameState.score.O);
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
        updateCurrentPlayerIndicator();
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

        try {
            // Очищаем предыдущие обработчики
            Telegram.MainButton.offClick();
            
            Telegram.MainButton
                .setParams({
                    color: buttonColor,
                    text_color: '#ffffff',
                    text: '🔄 Новая игра'
                })
                .show()
                .onClick(() => {
                    initializeGame();
                    Telegram.MainButton.hide();
                });
        } catch (e) {
            console.warn('MainButton error:', e);
        }

        try {
            Telegram.showAlert(message, () => {});
        } catch (e) {
            alert(message);
        }
    } else {
        // Для обычного браузера обновляем кнопку "Новая игра"
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
            newGameBtn.textContent = 'Новая игра';
        }
        setTimeout(() => alert(message), 100);
    }
};

const updateScore = () => {
    if (elements.scoreX) {
        elements.scoreX.textContent = gameState.score.X;
    }
    if (elements.scoreO) {
        elements.scoreO.textContent = gameState.score.O;
    }
};

// Обновление индикатора текущего игрока
const updateCurrentPlayerIndicator = () => {
    const currentPlayerIndicator = document.getElementById('currentPlayerIndicator');
    if (currentPlayerIndicator) {
        const playerName = gameState.currentPlayer === 'X' ? 'Крестики' : 'Нолики';
        const playerIcon = gameState.currentPlayer === 'X' 
            ? '<i class="fas fa-times"></i>' 
            : '<i class="far fa-circle"></i>';
        currentPlayerIndicator.innerHTML = `${playerIcon} Ход: ${playerName}`;
        currentPlayerIndicator.className = `current-player-indicator ${gameState.currentPlayer}`;
        
        // Показываем индикатор только в обычном браузере
        if (!isTelegramWebApp) {
            currentPlayerIndicator.style.display = 'block';
        }
    }
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

// ========== МНОГОПОЛЬЗОВАТЕЛЬСКИЙ РЕЖИМ ==========

// Создание новой игры
const createMultiplayerGame = async () => {
    try {
        const response = await fetch('/api/createGame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: gameParams.userId,
                userName: Telegram.initDataUnsafe?.user?.first_name || 'Player'
            })
        });
        
        const data = await response.json();
        if (data.success) {
            multiplayerState.isMultiplayer = true;
            multiplayerState.gameId = data.gameId;
            multiplayerState.playerNumber = 1;
            multiplayerState.mySymbol = 'X';
            
            // Показываем экран ожидания
            showWaitingScreen(data.inviteLink);
            
            // Начинаем polling для проверки присоединения оппонента
            startPolling();
        }
    } catch (error) {
        console.error('Error creating game:', error);
        alert('Ошибка при создании игры');
    }
};

// Присоединение к игре
const joinMultiplayerGame = async (gameId) => {
    try {
        const response = await fetch('/api/joinGame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: gameId,
                userId: gameParams.userId,
                userName: Telegram.initDataUnsafe?.user?.first_name || 'Player'
            })
        });
        
        const data = await response.json();
        if (data.success) {
            multiplayerState.isMultiplayer = true;
            multiplayerState.gameId = data.gameSession.gameId;
            multiplayerState.playerNumber = 2;
            multiplayerState.mySymbol = 'O';
            multiplayerState.opponentConnected = true;
            
            // Обновляем состояние игры
            updateGameFromServer(data.gameSession);
            
            // Показываем игровой экран
            showGameScreen();
            
            // Начинаем polling
            startPolling();
        } else {
            alert(data.error || 'Ошибка при присоединении к игре');
        }
    } catch (error) {
        console.error('Error joining game:', error);
        alert('Ошибка при присоединении к игре');
    }
};

// Отправка хода на сервер
const sendMoveToServer = async (cellIndex) => {
    if (!multiplayerState.isMultiplayer || !multiplayerState.gameId) return;
    
    try {
        const response = await fetch('/api/makeMove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: multiplayerState.gameId,
                userId: gameParams.userId,
                cellIndex: cellIndex
            })
        });
        
        const data = await response.json();
        if (data.success) {
            updateGameFromServer(data.gameSession);
        } else {
            alert(data.error || 'Ошибка при отправке хода');
        }
    } catch (error) {
        console.error('Error sending move:', error);
    }
};

// Получение состояния игры с сервера
const getGameState = async () => {
    if (!multiplayerState.isMultiplayer || !multiplayerState.gameId) return;
    
    try {
        const response = await fetch(`/api/getGameState?gameId=${multiplayerState.gameId}&userId=${gameParams.userId}`);
        const data = await response.json();
        
        if (data.success) {
            // Проверяем, присоединился ли оппонент
            if (data.gameSession.player2 && !multiplayerState.opponentConnected) {
                multiplayerState.opponentConnected = true;
                showGameScreen();
            }
            
            // Обновляем состояние игры
            updateGameFromServer(data.gameSession);
        }
    } catch (error) {
        console.error('Error getting game state:', error);
    }
};

// Обновление игры из данных сервера
const updateGameFromServer = (serverState) => {
    gameState.board = [...serverState.board];
    gameState.currentPlayer = serverState.currentPlayer;
    gameState.gameActive = serverState.gameActive;
    gameState.winner = serverState.winner;
    
    // Обновляем UI
    updateBoardUI();
    updateCurrentPlayerIndicator();
    
    if (serverState.winner) {
        endGame(serverState.winner === 'draw' ? 'Ничья!' : `Игрок ${serverState.winner} выиграл!`);
    }
};

// Обновление доски в UI
const updateBoardUI = () => {
    if (!elements.cells) return;
    
    elements.cells.forEach((cell, index) => {
        const symbol = gameState.board[index];
        if (symbol) {
            const icon = symbol === 'X' 
                ? '<i class="fas fa-times"></i>' 
                : '<i class="far fa-circle"></i>';
            cell.innerHTML = icon;
            cell.classList.add(symbol);
        } else {
            cell.innerHTML = '';
            cell.classList.remove('X', 'O');
        }
    });
};

// Polling для обновления состояния
const startPolling = () => {
    if (multiplayerState.pollingInterval) {
        clearInterval(multiplayerState.pollingInterval);
    }
    
    multiplayerState.pollingInterval = setInterval(() => {
        if (multiplayerState.isMultiplayer && multiplayerState.gameId) {
            getGameState();
        }
    }, 1000); // Проверяем каждую секунду
};

const stopPolling = () => {
    if (multiplayerState.pollingInterval) {
        clearInterval(multiplayerState.pollingInterval);
        multiplayerState.pollingInterval = null;
    }
};

// Показ экранов
const showGameModeScreen = () => {
    document.getElementById('gameModeScreen').style.display = 'block';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('joinScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
};

const showWaitingScreen = (inviteLink) => {
    document.getElementById('gameModeScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'block';
    document.getElementById('joinScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    
    const inviteLinkEl = document.getElementById('inviteLink');
    if (inviteLinkEl) {
        inviteLinkEl.textContent = inviteLink;
    }
};

const showJoinScreen = () => {
    document.getElementById('gameModeScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('joinScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
};

const showGameScreen = () => {
    document.getElementById('gameModeScreen').style.display = 'none';
    document.getElementById('waitingScreen').style.display = 'none';
    document.getElementById('joinScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
};

// ========== КОНЕЦ МНОГОПОЛЬЗОВАТЕЛЬСКОГО РЕЖИМА ==========


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
        e.stopPropagation();
        
        // Ищем ближайший cell-container (может быть клик по .cell, иконке или .cell-container)
        let cellContainer = e.target.closest('.cell-container');
        
        // Если клик был по .cell, ищем родительский .cell-container
        if (!cellContainer) {
            if (e.target.classList.contains('cell')) {
                cellContainer = e.target.parentElement;
            } else if (e.target.closest('.cell')) {
                cellContainer = e.target.closest('.cell').parentElement;
            }
        }
        
        if (cellContainer && cellContainer.dataset && cellContainer.dataset.index !== undefined) {
            const index = parseInt(cellContainer.dataset.index);
            if (!isNaN(index) && index >= 0 && index < 9) {
                handleMove(index);
            }
        }
    }, true); // Используем capture phase для более надежной обработки
    
    // Обработчик кнопки "Новая игра" для обычного браузера
    const newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            initializeGame();
        });
    }
    
    // Настройка UI в зависимости от окружения
    if (isTelegramWebApp) {
        // В Telegram WebApp скрываем наши кнопки (используется MainButton)
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.style.display = 'none';
        }
        const currentPlayerIndicator = document.getElementById('currentPlayerIndicator');
        if (currentPlayerIndicator) {
            currentPlayerIndicator.style.display = 'none';
        }
        
        // Дополнительная настройка для Telegram Game
        if (isTelegramGame) {
            // Убеждаемся, что MainButton работает правильно
            try {
                Telegram.MainButton.hide();
            } catch (e) {
                console.warn('MainButton init error:', e);
            }
        }
    } else {
        // В обычном браузере показываем все наши элементы управления
        const newGameBtn = document.getElementById('newGameBtn');
        if (newGameBtn) {
            newGameBtn.style.display = 'block';
        }
        const currentPlayerIndicator = document.getElementById('currentPlayerIndicator');
        if (currentPlayerIndicator) {
            currentPlayerIndicator.style.display = 'block';
        }
    }
    
    // Проверяем, есть ли gameId в URL (присоединение к игре)
    if (gameParams.gameId) {
        joinMultiplayerGame(gameParams.gameId);
    } else {
        // Показываем экран выбора режима (только если не Telegram Game)
        if (!isTelegramGame) {
            showGameModeScreen();
            
            // Обработчики кнопок
            const createGameBtn = document.getElementById('createGameBtn');
            const joinGameBtn = document.getElementById('joinGameBtn');
            const copyInviteBtn = document.getElementById('copyInviteBtn');
            const joinGameConfirmBtn = document.getElementById('joinGameConfirmBtn');
            
            if (createGameBtn) {
                createGameBtn.addEventListener('click', createMultiplayerGame);
            }
            
            if (joinGameBtn) {
                joinGameBtn.addEventListener('click', showJoinScreen);
            }
            
            if (copyInviteBtn) {
                copyInviteBtn.addEventListener('click', () => {
                    const inviteLink = document.getElementById('inviteLink');
                    if (inviteLink) {
                        navigator.clipboard.writeText(inviteLink.textContent).then(() => {
                            alert('Ссылка скопирована!');
                        });
                    }
                });
            }
            
            if (joinGameConfirmBtn) {
                joinGameConfirmBtn.addEventListener('click', () => {
                    const gameIdInput = document.getElementById('gameIdInput');
                    if (gameIdInput && gameIdInput.value) {
                        joinMultiplayerGame(gameIdInput.value);
                    } else {
                        alert('Введите ID игры');
                    }
                });
            }
        } else {
            // Telegram Game - одиночная игра
            showGameScreen();
            initializeGame();
        }
    }
});
