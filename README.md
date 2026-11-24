# Расширения Owlbear Rodeo

Комплект для репозитория **`AtomSalamander.github.io`** (сайт пользователя, файлы лежат в корне). Сборка не нужна.

1. Загрузи всё содержимое папки в корень репозитория `AtomSalamander.github.io` (ветка `main`). Рядом должны лежать `index.html`, `manifest.json`, `tracker.html` и папки `fx`, `move`, `status`, `music`, `legendary`, `emergence`.
2. Settings → Pages → Deploy from a branch → `main`, `/(root)`.
3. Проверь в браузере, что открывается, например, `https://atomsalamander.github.io/fx/icon.svg`.
4. Адреса манифестов для Owlbear Rodeo:
   - `https://atomsalamander.github.io/fx/manifest.json`
   - `https://atomsalamander.github.io/tracker-manifest.json`
   - `https://atomsalamander.github.io/move/manifest.json`
   - `https://atomsalamander.github.io/status/manifest.json`
   - `https://atomsalamander.github.io/music/manifest.json`
   - `https://atomsalamander.github.io/legendary/manifest.json`
   - `https://atomsalamander.github.io/emergence/manifest.json`

Все пути в манифестах и коде указаны от корня сайта (`/fx/...`, `/status/...` и т.д.). Если когда-нибудь переедешь в репозиторий с другим именем (например, `owlbear-dnd`), пути придётся снова поменять на `/owlbear-dnd/...`.
