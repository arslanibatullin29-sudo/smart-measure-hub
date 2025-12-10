#!/bin/bash

# Скрипт для запуска npm install через Docker

echo "📦 Запускаем npm install через Docker..."

docker run --rm \
  -v "$(pwd):/app" \
  -w /app \
  node:18-alpine \
  npm install

echo "✅ npm install завершен!"
echo "📝 Проверяем package-lock.json..."

if [ -f "package-lock.json" ]; then
    echo "✅ package-lock.json создан успешно"
    ls -lh package-lock.json
else
    echo "❌ package-lock.json не найден"
    exit 1
fi
