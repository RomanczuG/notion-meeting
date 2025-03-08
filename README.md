# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# Notion Meeting

Transcribe meetings with OpenAI's Whisper model and export to Notion.

## Features

- Real-time speech recognition with OpenAI's Whisper model
- Runs entirely in the browser (no server required for transcription)
- Speaker diarization (identification of different speakers)
- Export transcriptions to Notion
- Fully customizable and open-source

## Notion Integration Setup

### 1. Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Fill in the details:
   - Name: "Meeting Transcription" (or any name you prefer)
   - Select the workspace where you want to use the integration
   - For "Capabilities", enable "Read content", "Update content", and "Insert content"
   - For "OAuth Capabilities", enable "Read user information including email addresses"
4. For "Redirect URIs", add your application URL (e.g., `https://your-app-domain.com` or `http://localhost:3000` for local development)
5. Save the integration

After creating the integration, note down:
- Client ID: Used for OAuth authentication
- Client Secret: Will be used by the serverless function (keep this secure!)

### 2. Deploy with Cloudflare Pages

1. Push your project to a Git repository (GitHub, GitLab, etc.)
2. Connect your repository to Cloudflare Pages
3. Set up build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add environment variables in the Cloudflare Pages dashboard:
   - `NOTION_CLIENT_ID`: Your Notion integration Client ID
   - `NOTION_CLIENT_SECRET`: Your Notion integration Client Secret
5. Deploy your application

The serverless function at `/api/notion/oauth` will handle the OAuth token exchange.

## Local Development

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your Notion credentials
4. Start the development server: `npm run dev`

## Using the Notion Integration

1. Click "Connect Notion" in the application
2. Authorize the integration when prompted by Notion
3. After authorizing, you'll be redirected back to the application
4. Select a database or page where you want to store your transcriptions
5. Start recording to automatically send transcriptions to Notion
