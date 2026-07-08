# Model Clash — AI Debate Arena

Pit **OpenAI**, **Claude**, **Grok**, and **Gemini** against each other in multi-round debates. You bring the API keys; the app shuffles speaking order and lets each model respond to the full transcript so far.

![Next.js](https://img.shields.io/badge/Next.js-15+-black) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

## Features

- Sidebar setup: contentious prompt, rounds (1–5), per-response character limit
- **Demo / cheap mode** (on by default): locks to lowest-cost models (`gpt-4o-mini`, `claude-3-5-haiku-latest`, `grok-3-mini`, `gemini-2.0-flash`)
- Model checkboxes with editable model IDs when demo mode is off
- API keys stored in **browser localStorage only** — never written to disk or logs on the server
- Randomized speaking order on each “Start Debate”
- Sequential turns with full history; SSE streaming into chat bubbles
- Viewpoint system prompt: models argue *and* surface their training/alignment lean
- Graceful errors: invalid key, rate limit, quota, model not found
- Colored chat bubbles, SVG model avatars, typing indicators, timestamps, auto-scroll
- Progress bar with round + who’s thinking
- Collapsible settings sidebar (desktop) / drawer (mobile)
- Keyboard: **Enter** starts, **Esc** stops
- Shareable links via URL hash (`#d=…`) — transcript compressed client-side, no server storage
- Export transcript as Markdown or JSON
- Stop button, max 5 rounds, estimated token / cost warnings

## Security & cost

- Keys are sent only in the JSON body of `/api/debate` so the server can call providers (CORS). The route **does not** log keys or persist them.
- You are billed directly by each provider. Watch the cost panel before starting long debates.
- Prefer **Demo / cheap mode** while testing — still real API calls, just cheaper models.
- Clear keys anytime with the trash icon in the sidebar.

## Prerequisites

- Node.js 18.18+ (20+ recommended)
- API keys for the providers you enable (see below)

## Setup

```bash
git clone <your-repo-url>
cd thetruthcomesout
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No `.env` file is required for local use — paste keys in the UI. They stay in `localStorage` under `model-clash:*` keys.

## Getting API keys

| Provider | Demo (cheap) | Standard | Where to get a key |
|----------|--------------|----------|--------------------|
| OpenAI | `gpt-4o-mini` | `gpt-4o` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | `claude-3-5-haiku-latest` | `claude-sonnet-4-20250514` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| xAI (Grok) | `grok-3-mini` | `grok-3` | [console.x.ai](https://console.x.ai/) |
| Google Gemini | `gemini-2.0-flash` | `gemini-2.0-flash` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

Toggle **Demo / cheap mode** in the sidebar. When off, you can edit any model name freely.

## How a debate works

1. Enter a prompt, choose rounds (≤ 5) and a character limit (default 600).
2. Leave **Demo / cheap mode** on for low-cost testing (or turn it off for flagship models).
3. Enable at least two models and paste their API keys.
4. Click **Start Debate** — order is shuffled randomly.
5. Each turn streams into the UI. Later speakers see the full labeled history.
6. Hit **Stop** anytime; errors (bad key, rate limit) show in the bubble and the debate continues with the next model.

## Tech stack

- Next.js App Router + TypeScript + Tailwind CSS
- Official SDKs: `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`
- xAI via OpenAI-compatible client (`baseURL: https://api.x.ai/v1`)
- Proxy route: `src/app/api/debate/route.ts`

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [vercel.com/new](https://vercel.com/new).
3. Leave environment variables empty (keys are client-supplied).
4. Deploy. Framework preset: Next.js.

Or from the CLI:

```bash
npm i -g vercel
vercel
```

**Note:** Vercel serverless functions have a default timeout. Debates with many models/rounds may need a higher `maxDuration` (already set to 60s on the debate route on Pro plans). On Hobby, keep rounds and model count modest.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

## Project structure

```
src/
  app/
    api/debate/route.ts   # Provider proxy (keys not stored)
    page.tsx              # Main arena UI
    layout.tsx
  components/             # Sidebar, transcript, bubbles
  hooks/                  # localStorage + debate orchestration
  lib/                    # types, providers, export helpers
```

## License

MIT
