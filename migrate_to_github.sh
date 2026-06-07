#!/bin/bash

# Скрипт для переноса проекта в GitHub репозиторий
# https://github.com/arslanibatullin29-sudo/smart-measure-hub.git

set -e

echo "🚀 Начинаем перенос проекта в GitHub репозиторий..."

# Проверяем, инициализирован ли git
if [ ! -d .git ]; then
    echo "📦 Инициализируем git репозиторий..."
    git init
fi

# Добавляем или обновляем remote
echo "🔗 Настраиваем remote репозиторий..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/arslanibatullin29-sudo/smart-measure-hub.git

# Проверяем remote
echo "✅ Remote репозиторий настроен:"
git remote -v

# Добавляем все файлы
echo "📝 Добавляем все файлы..."
git add .

# Проверяем статус
echo "📊 Статус репозитория:"
git status --short | head -20

# Создаем коммит
echo "💾 Создаем коммит..."
git commit -m "Initial commit: перенос проекта room_app" || echo "⚠️  Нет изменений для коммита"

# Переименовываем ветку в main
echo "🌿 Настраиваем ветку main..."
git branch -M main 2>/dev/null || true

# Получаем данные из удаленного репозитория
echo "📥 Получаем данные из удаленного репозитория..."
git fetch origin || echo "⚠️  Не удалось получить данные (возможно, репозиторий пустой)"

# Делаем force push (заменяем весь код в репозитории)
echo "⬆️  Отправляем код в репозиторий (force push)..."
echo "⚠️  ВНИМАНИЕ: Это заменит весь код в удаленном репозитории!"
read -p "Продолжить? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push -u origin main --force
    echo "✅ Проект успешно перенесен в GitHub репозиторий!"
    echo "🔗 Репозиторий: https://github.com/arslanibatullin29-sudo/smart-measure-hub"
else
    echo "❌ Операция отменена"
    exit 1
fi
