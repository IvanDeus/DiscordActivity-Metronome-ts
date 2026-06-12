## DiscordActivity-Metronome-ts
# Discord Activity: Simple Metronome

A simple metronome app that runs inside **Discord Voice Channels** as an embedded Activity, using a **Bun backend** and **SQLite** for storing user BPM preferences.

> Works only inside Discord as an Activity

---

## ✅ Features

- Runs natively inside Discord via the Embedded App SDK
- Authenticates Discord users securely via OAuth2
- Saves/loads BPM settings from SQLite
- Audio click metronome with easily adjustable tempo
- Works securely over HTTPS
- Serves compliant **Terms of Service** and **Privacy Policy** pages at `/terms` and `/privacy`

---

## 📦 Requirements

### 💻 Local Development Tools

- Bun
- SQLite
- Discord Developer account with an Application created

### ⚙️ Server Setup (for production)

- Linux (Ubuntu/RedHat or similar) server
- Nginx or Cloudflare Tunnel (cloudflared)
- Domain name with DNS configured and HTTPS

---

## 🛠️ Installation Instructions

### Step 1: Get the App

Clone the repository or download the source code.

### Step 2: Create Environment & Install Dependencies

Install [Bun](https://bun.com/docs/installation). No external npm packages are needed as the project uses Bun's built-in APIs (`bun:sqlite` and `Bun.serve`).

If you wish to run the app in production using PM2, you will also need `pm2` installed via Node.js:
```bash
npm install -g pm2
```

### Step 3: 🤖 Set Up Your Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Under the **OAuth2** tab, save your **Client ID** and **Client Secret**, and add a redirect URI (base URL to the public HTTPS URL where your app is hosted).
3. Navigate to the **URL Mapping** section (or Activities settings) and set the same public HTTPS URL as on previous step.
4. In Supported Platforms section Allow iOS, Android and Web.
5. In **General Information**, fill in the **Terms of Service URL** (e.g., `https://<yourdomain>/terms`) and **Privacy Policy URL** (e.g., `https://<yourdomain>/privacy`) to comply with Discord's developer policies.

### Step 4: Configure App Backend

Copy dotenv-example to .env

Edit `.env` and add your actual data: `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.

### Step 5: 🏃🏻‍♂️ Run Your Metronome App

For development/testing, you can run the app directly using Bun:

```bash
bun run index.ts
```

To run the App in production in the background using **PM2**, run:

```bash
pm2 start index.ts --name "discord-metronome" --interpreter bun
```

This step will also automatically initialize the SQLite database (`metronome.db`) if it doesn't exist.
To view logs, run `pm2 logs discord-metronome`. To stop it, run `pm2 stop discord-metronome`.

### Step 6: Expose App Publicly

To test the app inside Discord, your application needs to be served over HTTPS. You can use Cloudflare Tunnels (recommended for quick testing):
```bash
cloudflared tunnel --url http://localhost:3000
```
Then paste the generated `https://` URL into the Discord Developer Portal URL mappings.

Alternatively, use Nginx for a production server:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    ssl_certificate /path/to/fullchain.cer;
    ssl_certificate_key /path/to/privkey.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Step 7: 🎉 Enjoy!

Hop into a Discord Voice Channel, launch your Activity, and start the metronome!

2026 [ ivan deus ] 
