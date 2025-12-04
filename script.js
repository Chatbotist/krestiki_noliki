// URL бэкенда на Render
// В продакшене можно вынести в переменную окружения Vercel,
// но сейчас используем конкретный URL сервиса Render.
const BACKEND_URL = 'https://krestiki-noliki-ykec.onrender.com';

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
        customAlert(message).then(() => {
            if (callback) callback();
        });
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

// ========== КАСТОМНЫЕ МОДАЛЬНЫЕ ОКНА ==========

// Кастомный alert
const customAlert = (message, title = 'Уведомление') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalOkBtn = document.getElementById('modalOkBtn');
        
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';
        
        const closeModal = () => {
            modal.style.display = 'none';
            resolve();
        };
        
        modalOkBtn.onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    });
};

// Кастомный confirm
const customConfirm = (message, title = 'Подтверждение') => {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmOkBtn = document.getElementById('confirmOkBtn');
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        modal.style.display = 'flex';
        
        const closeModal = (result) => {
            modal.style.display = 'none';
            resolve(result);
        };
        
        confirmOkBtn.onclick = () => closeModal(true);
        confirmCancelBtn.onclick = () => closeModal(false);
        modal.onclick = (e) => {
            if (e.target === modal) closeModal(false);
        };
    });
};

// Показать индикатор ожидания
const showWaitingIndicator = (text = 'Ожидание...') => {
    const indicator = document.getElementById('waitingIndicator');
    const waitingText = document.getElementById('waitingText');
    waitingText.textContent = text;
    indicator.style.display = 'flex';
};

// Скрыть индикатор ожидания
const hideWaitingIndicator = () => {
    const indicator = document.getElementById('waitingIndicator');
    indicator.style.display = 'none';
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
    resultShown: false, // чтобы не показывать алерт несколько раз
    totalWins: 0, // Общее количество побед для отправки в Telegram
    isPlayerX: true, // Игрок играет за X
    pendingReset: null,
    resetDialogShown: false,
    resetRejectedShown: false,
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
    gameState.resultShown = false;
    gameState.pendingReset = null;
    gameState.resetDialogShown = false;
    gameState.resetRejectedShown = false;
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
    if (multiplayerState.isMultiplayer) {
        // В многопользовательском режиме проверяем, наш ли это ход
        if (gameState.currentPlayer !== multiplayerState.mySymbol) {
            customAlert('Сейчас не ваш ход!', 'Уведомление');
            return;
        }
        
        if (!gameState.gameActive || gameState.board[index] || !elements.cells) return;
        
        vibrate();
        sendMoveToServer(index);
    } else {
        // Одиночная игра
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
    }
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
    // Если уже показывали результат на этом клиенте, выходим
    if (gameState.resultShown) return;
    gameState.resultShown = true;

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
                    if (multiplayerState.isMultiplayer) {
                        requestNewRound();
                    } else {
                        initializeGame();
                        Telegram.MainButton.hide();
                    }
                });
        } catch (e) {
            console.warn('MainButton error:', e);
        }

        try {
            Telegram.showAlert(message, () => {});
        } catch (e) {
            customAlert(message, 'Результат игры');
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
        setTimeout(() => customAlert(message, 'Результат игры'), 100);
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
        const response = await fetch(`${BACKEND_URL}/api/createGame`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: gameParams.userId,
                userName: Telegram.initDataUnsafe?.user?.first_name || 'Player'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response');
        }
        
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
        } else {
            throw new Error(data.error || 'Failed to create game');
        }
    } catch (error) {
        console.error('Error creating game:', error);
        const errorMsg = error.message || 'Ошибка при создании игры';
        customAlert(errorMsg, 'Ошибка');
    }
};

// Присоединение к игре
const joinMultiplayerGame = async (gameId) => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/joinGame`, {
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
            customAlert(data.error || 'Ошибка при присоединении к игре', 'Ошибка');
        }
    } catch (error) {
        console.error('Error joining game:', error);
        customAlert('Ошибка при присоединении к игре', 'Ошибка');
    }
};

// Отправка хода на сервер
const sendMoveToServer = async (cellIndex) => {
    if (!multiplayerState.isMultiplayer || !multiplayerState.gameId) return;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/makeMove`, {
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
            customAlert(data.error || 'Ошибка при отправке хода', 'Ошибка');
        }
    } catch (error) {
        console.error('Error sending move:', error);
    }
};

// Запрос нового раунда
const requestNewRound = async () => {
    if (!multiplayerState.isMultiplayer || !multiplayerState.gameId) {
        initializeGame();
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/resetGame`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: multiplayerState.gameId,
                userId: gameParams.userId,
                action: 'request',
            }),
        });

        const data = await response.json();
        if (data.success) {
            updateGameFromServer(data.gameSession);
            // Показываем индикатор ожидания вместо alert
            showWaitingIndicator('Ждём ответа соперника...');
        } else {
            hideWaitingIndicator();
            customAlert(data.error || 'Ошибка при запросе нового раунда', 'Ошибка');
        }
    } catch (error) {
        console.error('Error requesting new round:', error);
        hideWaitingIndicator();
        customAlert('Ошибка при запросе нового раунда', 'Ошибка');
    }
};

// Ответ на запрос нового раунда
const respondToNewRound = async (accept) => {
    if (!multiplayerState.isMultiplayer || !multiplayerState.gameId) return;

    const action = accept ? 'accept' : 'reject';

    try {
        const response = await fetch(`${BACKEND_URL}/api/resetGame`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: multiplayerState.gameId,
                userId: gameParams.userId,
                action,
            }),
        });

        const data = await response.json();
        if (data.success) {
            if (accept) {
                // Игра сброшена на сервере - обновляем состояние и инициализируем
                gameState.winner = null;
                gameState.resultShown = false;
                gameState.resetDialogShown = false;
                gameState.resetRejectedShown = false;
                updateGameFromServer(data.gameSession);
                initializeGame();
            } else {
                updateGameFromServer(data.gameSession);
                customAlert('Вы отклонили предложение о новом раунде.', 'Уведомление');
            }
        } else {
            customAlert(data.error || 'Ошибка при обработке запроса нового раунда', 'Ошибка');
        }
    } catch (error) {
        console.error('Error responding to new round:', error);
        customAlert('Ошибка при обработке запроса нового раунда', 'Ошибка');
    }
};

// Получение состояния игры с сервера
const getGameState = async () => {
    if (!multiplayerState.isMultiplayer || !multiplayerState.gameId) return;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/getGameState?gameId=${multiplayerState.gameId}&userId=${gameParams.userId}`);
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
    gameState.pendingReset = serverState.pendingReset || null;
    
    // Обновляем UI
    updateBoardUI();
    updateCurrentPlayerIndicator();

    // Обработка завершённой игры (многопользовательский режим)
    if (serverState.winner && !gameState.resultShown) {
        // В мультиплеере увеличиваем счёт победителя (кроме ничьи)
        if (serverState.winner === 'X' || serverState.winner === 'O') {
            gameState.score[serverState.winner] = (gameState.score[serverState.winner] || 0) + 1;
            updateScore();
        }
        endGame(serverState.winner === 'draw' ? 'Ничья!' : `Игрок ${serverState.winner} выиграл!`);
    }

    // Обработка запросов на новый раунд
    const pending = gameState.pendingReset;
    const myId = gameParams.userId;

    if (pending && pending.status === 'requested') {
        // Если запрос пришёл от соперника и мы ещё не показывали диалог
        if (pending.by !== myId && !gameState.resetDialogShown) {
            gameState.resetDialogShown = true;
            customConfirm('Соперник предлагает сыграть ещё раз. Принять?', 'Новый раунд')
                .then(accept => {
                    respondToNewRound(accept);
                });
        }
        // Если мы отправили запрос - показываем индикатор ожидания
        if (pending.by === myId) {
            showWaitingIndicator('Ждём ответа соперника...');
        }
    } else if (pending && pending.status === 'rejected') {
        // Наш запрос отклонён соперником
        if (pending.by === myId && !gameState.resetRejectedShown) {
            gameState.resetRejectedShown = true;
            hideWaitingIndicator();
            customAlert('Соперник отказался от нового раунда.', 'Уведомление');
        }
    } else {
        // Нет активного запроса — скрываем индикатор и сбрасываем локальные флаги
        hideWaitingIndicator();
        gameState.resetDialogShown = false;
        // resetRejectedShown сбрасывать не будем, чтобы не повторять сообщение
    }

    // Если игра активна и нет pending reset - скрываем индикатор
    if (gameState.gameActive && !pending) {
        hideWaitingIndicator();
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
            if (multiplayerState.isMultiplayer) {
                requestNewRound();
            } else {
                initializeGame();
            }
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
                            customAlert('Ссылка скопирована!', 'Успешно');
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
                        customAlert('Введите ID игры', 'Ошибка');
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
