# 🚀 Setup Instructions - Telegram PDF Bot

Follow these steps to deploy your Telegram to PDF Bot using Google Apps Script.

## 1. Create a Telegram Bot
1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. Follow the prompts to name your bot.
4. **Copy the HTTP API Token**. You will need this later.

## 2. Create the Google Apps Script Project
1. Go to [script.google.com](https://script.google.com/).
2. Click **New Project**.
3. Rename the project to "Telegram PDF Bot".
4. Create the following files and copy the code provided:
    - **`Code.gs`**
    - **`Bot.gs`**
    - **`Converter.gs`**
    - **`Utils.gs`**

## 3. Enable Google Drive API
1. In the Apps Script Editor, go to **Project Settings** (gear icon) > **General Settings**.
2. Check "Show 'appsscript.json' manifest file in editor".
3. In the sidebar, click `< > Editor`.
4. Click the **Services +** button (left sidebar).
5. Select **Drive API** (make sure it says Drive API, not Drive Activity API).
6. Click **Add**.

## 4. Setup Google Sheet Database
1. Go to [sheets.google.com](https://sheets.google.com) and create a **New Spreadsheet**.
2. Name it "Telegram Bot Users".
3. **Copy the Spreadsheet ID** from the URL.
   *   URL format: `https://docs.google.com/spreadsheets/d/`**`1aBcD...`**`/edit`
   *   The ID is the long string of characters between `/d/` and `/edit`.

## 5. Set Script Properties (Environment Variables)
1. Go to **Project Settings** (gear icon).
2. Scroll to **Script Properties**.
3. Click **Add script property**. Add the following:
    - `BOT_TOKEN`: Paste your Telegram Bot Token.
    - `ADMIN_IDS`: Your Telegram User ID (e.g., `123456789`). You can get this from @userinfobot.
    - `SPREADSHEET_ID`: Paste the Google Sheet ID you copied.
    - `MAX_FILE_SIZE`: `20971520` (for 20MB).

## 6. Deploy as Web App
1. Click **Deploy** > **New Deployment**.
2. Select type: **Web app**.
3. Description: "v1".
4. **Execute as**: Me.
5. **Who has access**: **Anyone** (This is required for Telegram to send POST requests to your bot).
6. Click **Deploy**.
7. **Authorize** the script when prompted.
8. **Copy the Web App URL** (e.g., `https://script.google.com/macros/s/.../exec`).

## 7. Set the Webhook
You need to tell Telegram to send messages to your Web App URL.
1. Run this function in your script (or just paste into browser address bar):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEB_APP_URL>
   ```
   *Replace `<YOUR_BOT_TOKEN>` and `<YOUR_WEB_APP_URL>` with actual values.*
2. You should see a response: `{"ok":true, "result":true, "description":"Webhook was set"}`.

## 8. Test It!
1. Send `/start` to your bot in Telegram.
2. Check your Google Sheet - you should see a new row with your info!
3. Send `/admin` (if you added your ID to `ADMIN_IDS`) to see the menu.
4. Send a `.docx` file and wait for the PDF!

## Troubleshooting
- **File size error**: Increase `MAX_FILE_SIZE` in properties (Google limit is approx 50MB).
- **Conversion failed**: Ensure Drive API is added in Services.
- **No response**: Check execution logs in Apps Script dashboard for errors.
