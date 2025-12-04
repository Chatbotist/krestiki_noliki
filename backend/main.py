from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict
import uuid
from datetime import datetime, timedelta
import uvicorn

app = FastAPI(title="Tic Tac Toe Multiplayer API")

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory хранилище (в продакшене использовать Redis или PostgreSQL)
games: Dict[str, dict] = {}

# Модели данных
class CreateGameRequest(BaseModel):
    userId: str
    userName: Optional[str] = None

class JoinGameRequest(BaseModel):
    gameId: str
    userId: str
    userName: Optional[str] = None

class MakeMoveRequest(BaseModel):
    gameId: str
    userId: str
    cellIndex: int

class ResetGameRequest(BaseModel):
    gameId: str
    userId: str
    action: str  # 'request', 'accept', 'reject'

# Вспомогательные функции
def check_winner(board: list) -> Optional[str]:
    """Проверяет наличие победителя"""
    winning_combinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ]
    
    for combo in winning_combinations:
        if board[combo[0]] and board[combo[0]] == board[combo[1]] == board[combo[2]]:
            return board[combo[0]]
    return None

def cleanup_old_games():
    """Удаляет игры старше 1 часа"""
    now = datetime.now()
    games_to_delete = []
    
    for game_id, game in games.items():
        created_at = datetime.fromisoformat(game['createdAt'])
        if now - created_at > timedelta(hours=1):
            games_to_delete.append(game_id)
    
    for game_id in games_to_delete:
        del games[game_id]

# API Endpoints
@app.post("/api/createGame")
async def create_game(request: CreateGameRequest):
    """Создает новую игровую сессию"""
    cleanup_old_games()
    
    game_id = f"game_{uuid.uuid4().hex[:12]}"
    
    game_session = {
        "gameId": game_id,
        "player1": {
            "userId": request.userId,
            "userName": request.userName or f"Player_{request.userId[:8]}",
            "symbol": "X"
        },
        "player2": None,
        "board": ['', '', '', '', '', '', '', '', ''],
        "currentPlayer": "X",
        "gameActive": False,
        "winner": None,
        "createdAt": datetime.now().isoformat(),
        "lastMove": None,
        "pendingReset": None  # информация о запросе нового раунда
    }
    
    games[game_id] = game_session
    
    # Получаем базовый URL из переменных окружения
    import os
    base_url = os.getenv("FRONTEND_URL", "https://krestiki-noliki-liard.vercel.app")
    
    return {
        "success": True,
        "gameId": game_id,
        "inviteLink": f"{base_url}/?gameId={game_id}&player=2"
    }

@app.post("/api/joinGame")
async def join_game(request: JoinGameRequest):
    """Присоединение к игре"""
    cleanup_old_games()
    
    if request.gameId not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[request.gameId]
    
    if game["player2"]:
        raise HTTPException(status_code=400, detail="Game is already full")
    
    if game["player1"]["userId"] == request.userId:
        raise HTTPException(status_code=400, detail="You cannot join your own game")
    
    # Добавляем второго игрока
    game["player2"] = {
        "userId": request.userId,
        "userName": request.userName or f"Player_{request.userId[:8]}",
        "symbol": "O"
    }
    game["gameActive"] = True
    game["currentPlayer"] = "X"
    
    return {
        "success": True,
        "gameSession": {
            "gameId": game["gameId"],
            "player1": game["player1"],
            "player2": game["player2"],
            "board": game["board"],
            "currentPlayer": game["currentPlayer"],
            "gameActive": game["gameActive"]
        }
    }

@app.post("/api/makeMove")
async def make_move(request: MakeMoveRequest):
    """Отправка хода"""
    cleanup_old_games()
    
    if request.gameId not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[request.gameId]
    
    if not game["gameActive"]:
        raise HTTPException(status_code=400, detail="Game is not active")
    
    # Проверяем, что пользователь является игроком
    is_player1 = game["player1"]["userId"] == request.userId
    is_player2 = game["player2"] and game["player2"]["userId"] == request.userId
    
    if not is_player1 and not is_player2:
        raise HTTPException(status_code=403, detail="You are not a player in this game")
    
    player_symbol = "X" if is_player1 else "O"
    
    # Проверяем, что сейчас ход этого игрока
    if game["currentPlayer"] != player_symbol:
        raise HTTPException(status_code=400, detail="Not your turn")
    
    # Проверяем, что ячейка свободна
    if game["board"][request.cellIndex] != '':
        raise HTTPException(status_code=400, detail="Cell is already occupied")
    
    # Делаем ход
    game["board"][request.cellIndex] = player_symbol
    game["currentPlayer"] = "O" if player_symbol == "X" else "X"
    game["lastMove"] = {
        "cellIndex": request.cellIndex,
        "player": player_symbol,
        "timestamp": datetime.now().isoformat()
    }
    
    # Проверяем победу
    winner = check_winner(game["board"])
    if winner:
        game["winner"] = winner
        game["gameActive"] = False
    elif all(cell != '' for cell in game["board"]):
        # Ничья
        game["winner"] = "draw"
        game["gameActive"] = False
    
    return {
        "success": True,
        "gameSession": {
            "gameId": game["gameId"],
            "board": game["board"],
            "currentPlayer": game["currentPlayer"],
            "gameActive": game["gameActive"],
            "winner": game["winner"],
            "lastMove": game["lastMove"]
        }
    }

@app.get("/api/getGameState")
async def get_game_state(gameId: str, userId: Optional[str] = None):
    """Получение текущего состояния игры"""
    cleanup_old_games()
    
    if gameId not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[gameId]
    
    # Проверяем, что пользователь является игроком (если userId указан)
    if userId:
        is_player1 = game["player1"]["userId"] == userId
        is_player2 = game["player2"] and game["player2"]["userId"] == userId
        
        if not is_player1 and not is_player2:
            raise HTTPException(status_code=403, detail="You are not a player in this game")
    
    return {
        "success": True,
        "gameSession": {
            "gameId": game["gameId"],
            "player1": game["player1"],
            "player2": game["player2"],
            "board": game["board"],
            "currentPlayer": game["currentPlayer"],
            "gameActive": game["gameActive"],
            "winner": game["winner"],
            "lastMove": game["lastMove"],
            "pendingReset": game.get("pendingReset"),
        }
    }
    return {
        "success": True,
        "gameSession": {
            "gameId": game["gameId"],
            "player1": game["player1"],
            "player2": game["player2"],
            "board": game["board"],
            "currentPlayer": game["currentPlayer"],
            "gameActive": game["gameActive"],
            "winner": game["winner"],
            "lastMove": game["lastMove"],
            "pendingReset": game.get("pendingReset"),
        }
    }

@app.post("/api/resetGame")
async def reset_game(request: ResetGameRequest):
    """Логика нового раунда с подтверждением от соперника"""
    cleanup_old_games()

    if request.gameId not in games:
        raise HTTPException(status_code=404, detail="Game not found")

    game = games[request.gameId]

    # Проверяем, что пользователь является игроком
    is_player1 = game["player1"]["userId"] == request.userId
    is_player2 = game["player2"] and game["player2"]["userId"] == request.userId

    if not is_player1 and not is_player2:
        raise HTTPException(status_code=403, detail="You are not a player in this game")

    action = request.action.lower()
    now_iso = datetime.now().isoformat()

    # Инициатор просит новый раунд
    if action == "request":
        game["pendingReset"] = {
            "by": request.userId,
            "status": "requested",
            "at": now_iso,
        }

    # Второй игрок принимает
    elif action == "accept":
        pending = game.get("pendingReset")
        if not pending or pending["status"] != "requested":
            raise HTTPException(status_code=400, detail="No reset request to accept")
        if pending["by"] == request.userId:
            raise HTTPException(status_code=400, detail="You cannot accept your own request")

        # Сбрасываем игру
        game["board"] = ['', '', '', '', '', '', '', '', '']
        game["currentPlayer"] = "X"
        game["gameActive"] = True
        game["winner"] = None
        game["lastMove"] = None
        game["pendingReset"] = None

    # Второй игрок отказывается
    elif action == "reject":
        pending = game.get("pendingReset")
        if not pending or pending["status"] != "requested":
            raise HTTPException(status_code=400, detail="No reset request to reject")
        if pending["by"] == request.userId:
            raise HTTPException(status_code=400, detail="You cannot reject your own request")

        game["pendingReset"] = {
            "by": pending["by"],
            "status": "rejected",
            "rejectedBy": request.userId,
            "at": pending.get("at", now_iso),
        }

    else:
        raise HTTPException(status_code=400, detail="Unknown reset action")

    return {
        "success": True,
        "gameSession": {
            "gameId": game["gameId"],
            "player1": game["player1"],
            "player2": game["player2"],
            "board": game["board"],
            "currentPlayer": game["currentPlayer"],
            "gameActive": game["gameActive"],
            "winner": game["winner"],
            "pendingReset": game.get("pendingReset"),
        }
    }

@app.get("/")
async def root():
    return {"message": "Tic Tac Toe Multiplayer API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "games_count": len(games)}

# Health check для Render (должен отвечать быстро)
@app.get("/ping")
async def ping():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

