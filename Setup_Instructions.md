# 🚀 Setup Instructions - Telegram PDF Bot (Vercel + GAS Bridge)

This architecture uses Vercel as a bridge to trigger Google Apps Script, ensuring stability and security.

## 1. Create a Telegram Bot
1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts.
3. **Copy the HTTP API Token**.

## 2. Google Apps Script Setup
1. Create a new project at [script.google.com](https://script.google.com).
2. Copy the contents of `Code.gs`, `Bot.gs`, `Converter.gs`, and `Utils.gs` from this repository.
3. **Enable Drive API**: In the sidebar, click **Services +** > **Drive API** > **Add**.
4. **Deploy as Web App**:
   - Click **Deploy** > **New Deployment**.
   - Select **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy** and **Authorize**.
   - **Copy the Web App URL**.

## 3. Vercel Deployment
1. Deploy the `api` folder and `vercel.json` to Vercel.
2. Set the following **Environment Variables** in Vercel:
   - `APPS_SCRIPT_URL`: Paste the GAS Web App URL.
   - `GAS_SECRET`: A random string for security (e.g., `my_secure_token_123`).
3. **Copy your Vercel URL** (e.g., `https://your-project.vercel.app`).

## 4. Configure Script Properties
1. In the Apps Script Editor, go to **Project Settings** (gear icon).
2. Add the following **Script Properties**:
   - `BOT_TOKEN`: Your Telegram Bot Token.
   - `ADMIN_ID`: Your Telegram User ID.
   - `SPREADSHEET_ID`: Your Google Sheet ID.
   - `GAS_SECRET`: Must match the `GAS_SECRET` in Vercel.
   - `VERCEL_URL`: Your Vercel App URL.

## 5. Final Setup
1. In the Apps Script editor, open `Utils.gs`.
2. Select the `startWebhook` function and click **Run**.
3. This will link your Telegram Bot to the Vercel Bridge.

## 6. Test
1. Send `/start` to your bot.
2. Send a `.docx`, `.xlsx`, or `.pptx` file to convert.
