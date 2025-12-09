#!/bin/bash
# Скрипт запуска для Render
echo "Starting server on port $PORT..."
uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1



