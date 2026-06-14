# Slack Order Bot - Setup & Deployment Guide

This guide outlines the steps required to configure, test, and deploy your Slack Order Bot.

## 1. Slack App Configuration

Go to the [Slack API Dashboard](https://api.slack.com/apps) and create a new app "From scratch".

### A. App Credentials

- **Signing Secret**: Copy this from 'Basic Information' to `SLACK_SIGNING_SECRET` in `.env`.

### B. Socket Mode

- Go to **Socket Mode** in the sidebar.
- Enable Socket Mode.
- Generate an **App-level Token** with the `connections:write` scope.
- Copy this token to `SLACK_APP_TOKEN` in `.env` (it starts with `xapp-`).

### C. Slash Commands & Events

- Go to **Event Subscriptions**.
- Enable Events.
- Under **Subscribe to bot events**, add `app_mention`.
- Save Changes.

### D. OAuth & Permissions

- Go to **OAuth & Permissions**.
- Under **Scopes > Bot Token Scopes**, ensure you have:
  - `app_mentions:read`
  - `chat:write`
- Click **Install to Workspace**.
- Copy the **Bot User OAuth Token** to `SLACK_BOT_TOKEN` in `.env` (it starts with `xoxb-`).

---

## 2. OpenAI Setup

- Go to the [OpenAI Dashboard](https://platform.openai.com/api-keys).
- Create a new API Key and copy it to `OPENAI_API_KEY` in `.env`.
- Ensure your account has credits to use `gpt-4o-mini` and the Assistants API.

---

## 3. Environment Variables (`.env`)

Ensure your `.env` file is fully populated:

```env
ZUPA_PRODUCTS_API=https://api.zupa.ng
ZUPA_PRODUCTS_TOKEN=your_zupa_token

SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

OPENAI_API_KEY=sk-your-openai-key
OPENAI_ASSISTANT_ID= # Leave blank on first run; the bot will log a new ID for you.
```

---

## 4. Local Testing

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start the Bot**:
   ```bash
   npm start
   ```
3. **Verify Sync**: Check the console output. You should see "AI memory synced" and a generated **Assistant ID**.
4. **Invite Bot**: Invite your bot to a Slack channel (`/invite @YourBotName`).
5. **Post an Order**: Tag the bot with a sample order from `instruction.txt`, for example:

   ```text
   @YourBotName
   Jessica
   167 Kusenla Road Ikate Lekki Lagos
   09034806283

   Banana mini x3
   Delivery 3000
   ```

6. **Check Response**: The bot should reply with a processing status and then a success/error message.

---

## 5. Automated Daily Sync
The bot is configured to refresh its product knowledge automatically:
- **On Startup**: It fetches products and updates AI memory immediately.
- **Every 24 Hours**: A scheduled task (cron job) runs at midnight every day to ensure pricing and product IDs are always up to date.

## 6. Handling Ambiguity

The bot is programmed to fail if:

- The product name doesn't match the system.
- The size (Mini, Midi, etc.) is missing or incorrect.
- The price calculation is wildly inconsistent with the system.

If you get an "Ambiguity" error, refine your Slack message to be more specific.

---

## 6. Production Deployment

To keep the bot running 24/7:

1. Host it on a VPS (DigitalOcean, AWS, etc.) or a platform like Heroku/Render.
2. Use a process manager like `pm2`:
   ```bash
   npm install pm2 -g
   pm2 start index.js --name "slack-order-bot"
   pm2 save
   ```
