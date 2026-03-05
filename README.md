# Sora Prompt Queue (Chrome Extension)

Розширення для Chrome, яке:
- бере список промптів (1 рядок = 1 промпт),
- дозволяє вибрати `.txt` файл з промптами,
- вставляє їх у поле Sora,
- натискає кнопку `Create` автоматично.

## Встановлення

1. Відкрий `chrome://extensions`.
2. Увімкни `Developer mode`.
3. Натисни `Load unpacked`.
4. Вибери папку: `F:\sora_chrome_extension`.

## Використання

1. Відкрий `https://sora.chatgpt.com/library`.
2. Увійди в потрібний Google/OpenAI акаунт.
3. Відкрий popup розширення.
4. Встав промпти або натисни `Вибрати .txt`.
5. Натисни `Запустити`.

## Важливо

- Розширення не обходить обмеження доступу.
- Якщо Sora показує `Sora is not available right now`, відправка не піде.

## Що не пушити в Git

- Папки профілю браузера (`User Data`, `Profile *`, `Default`, `chrome_debug_profile`).
- Будь-які cookies/session дані.
- Локальні службові файли (`.venv`, `__pycache__`, логи, тимчасові файли).
