#!/usr/bin/env bash
# Перенос игры «Проект Вавилон» из realty/babylon в отдельный репозиторий the_game_b.
# Запускать ЛОКАЛЬНО на своём компьютере (там, где есть доступ к обоим репозиториям GitHub).
#
# Использование:
#   1) Сначала забери свежую ветку realty с игрой:
#        git clone https://github.com/logist888/realty.git
#        cd realty && git checkout claude/eager-fermi-0el3ws && git pull
#   2) Из корня этого клона realty запусти:
#        bash babylon/scripts/migrate_to_the_game_b.sh
set -euo pipefail

REALTY_DIR="$(cd "$(dirname "$0")/../.." && pwd)"   # корень realty
GAME_SRC="$REALTY_DIR/babylon"
TARGET_URL="https://github.com/logist888/the_game_b.git"
WORK="$(mktemp -d)"

echo "→ Клонирую $TARGET_URL ..."
git clone "$TARGET_URL" "$WORK/the_game_b"
cd "$WORK/the_game_b"

echo "→ Копирую файлы игры в корень нового репозитория ..."
# копируем всё из babylon/, кроме служебных каталогов
rsync -a --exclude '.git' --exclude 'scripts/migrate_to_the_game_b.sh' "$GAME_SRC"/ ./

echo "→ Создаю Pages-workflow для деплоя из корня ..."
mkdir -p .github/workflows
cat > .github/workflows/pages.yml <<'YML'
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
YML

git add -A
git commit -m "Импорт игры «Проект Вавилон» (перенос из realty/babylon)"
git branch -M main
git push -u origin main

echo ""
echo "✅ Готово. Игра запушена в the_game_b (ветка main)."
echo "   Дальше: GitHub → the_game_b → Settings → Pages → Source: GitHub Actions."
echo "   Сайт будет тут: https://logist888.github.io/the_game_b/"
echo "   Этот адрес и указывай боту в BotFather (Menu Button / Mini App URL)."
rm -rf "$WORK"
