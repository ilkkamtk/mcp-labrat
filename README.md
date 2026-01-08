# mcp-labrat

Voice + MCP calendar demo.

This project is a small Express app that:

- Hosts an MCP server (Streamable HTTP transport) that exposes calendar tools backed by a CalDAV server
- Hosts an HTTP “MCP client” endpoint that sends a prompt to an OpenAI-compatible Chat Completions API and lets the model call those MCP tools
- Serves a simple browser UI (in `public/`) that records audio, transcribes it (Whisper API), and sends the resulting prompt to the MCP client endpoint

## Requirements

- Node.js 18+ (Node 20+ recommended)
- A CalDAV server + credentials (or accept the defaults, but tools won’t be useful)
- An OpenAI-compatible API endpoint for:
  - Chat Completions (`/v1/chat/completions`)
  - Audio Transcriptions (`/v1/audio/transcriptions`)

## Quick start

1. Install

   ```bash
   npm install
   ```

2. Create `.env`

   ```bash
   cp .env.example .env
   ```

3. Run the dev server

   ```bash
   npm run dev
   ```

4. Open the demo UI
   - Visit `http://localhost:3000/`
   - Click “Start Recording”, speak a command, then click “Stop Recording”
   - Click “Send”

## Environment variables

Create a `.env` file in the project root.

### Server

- `PORT` (optional, default: `3000`)
- `NODE_ENV` (optional, e.g. `development`)

### MCP client + OpenAI-compatible API

- `MCP_SERVER_URL` (required)
  - Example: `http://localhost:3000/api/v1/mcp`
  - This can point back to the same server instance.
- `OPENAI_API_URL` (required)
  - Example: `https://api.openai.com`
- `OPENAI_MODEL` (optional, default: `gpt-4o`)

### Audio transcription (Whisper)

- `OPENAI_API_KEY` (required for transcription)
  - Used as `Authorization: Bearer ...` when calling `/v1/audio/transcriptions`.

### CalDAV (calendar backing store)

- `CALDAV_SERVER_URL` (optional, default: `http://localhost:5232/`)
- `CALDAV_USERNAME` (optional, default: `username`)
- `CALDAV_PASSWORD` (optional, default: `password`)

## Scripts

- `npm run dev` – run server with nodemon + ts-node
- `npm run build` – compile TypeScript to `dist/`
- `npm start` – run the compiled server (`dist/index.js`)

## API

Base path is `/api/v1`.

### Health

`GET /api/v1/`

Returns a simple JSON message.

### MCP server

`POST /api/v1/mcp`

Implements the MCP Streamable HTTP transport.

### MCP client

`POST /api/v1/client`

Accepts either:

1. JSON (text prompt)

```bash
curl -sS \
 -H 'Content-Type: application/json' \
 -d '{"prompt":"List my events","timezone":"Europe/Helsinki"}' \
 http://localhost:3000/api/v1/client
```

1. `multipart/form-data` (audio upload)

The field name must be `audio`.

```bash
curl -sS \
 -F 'audio=@command.webm' \
 -F 'timezone=Europe/Helsinki' \
 http://localhost:3000/api/v1/client
```

Response:

```json
{
  "answer": "...",
  "toolCalls": 2
}
```

## MCP tools

The MCP server currently exposes:

- `listEvents` – list events in the primary CalDAV calendar
- `getEventsInTimeSlot` – check availability for a time slot (relative date inputs)
- `createEvent` – create an event (relative date inputs + title + optional description/location)

The MCP client instructs the model to use tools for all user requests and applies some workflow rules (e.g., check availability before creating events when the user asks “if the time is free”).

## Troubleshooting

- **Mic permission**: The browser will prompt for microphone access the first time. If recording fails, check site permissions.
- **CalDAV auth**: If the calendar tools always return empty results, verify `CALDAV_*` values and that your user has at least one calendar.
- **OpenAI URL**: `OPENAI_API_URL` must be the base URL; the app calls `/v1/chat/completions` and `/v1/audio/transcriptions` under it.
- **Uploads cleanup**: Uploaded audio is deleted best-effort after transcription; check filesystem permissions if `uploads/` grows unexpectedly.

---

## API doc: `POST /api/v1/client`

Runs a user prompt through the MCP client. The server will call an OpenAI-compatible Chat Completions API, and the model can invoke MCP calendar tools (via the MCP server URL).

### Request

Supported content types:

1. `application/json` (text prompt)

- `prompt` (string, required) – the user command/question
- `timezone` (string, optional) – IANA timezone name (defaults to the server’s default timezone). See: [List of tz database time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

JSON request body example:

```json
{
  "prompt": "List my events",
  "timezone": "Europe/Helsinki"
}
```

Example:

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"List my events","timezone":"Europe/Helsinki"}' \
  http://localhost:3000/api/v1/client
```

Option 2: `multipart/form-data` (audio)

- `audio` (file, required) – audio file to transcribe (browser demo sends `audio/webm`)
- `timezone` (string, optional) – IANA timezone name

In this mode the server transcribes the audio first and uses the transcription text as the prompt.

Example:

```bash
curl -sS \
  -F 'audio=@command.webm' \
  -F 'timezone=Europe/Helsinki' \
  http://localhost:3000/api/v1/client
```

### Response

On success (HTTP 200):

```json
{
  "answer": "...",
  "toolCalls": 2
}
```

- `answer` (string) – final assistant output
- `toolCalls` (number) – total number of tool calls made during the run

### Errors

- `400` – invalid request body (e.g., missing `prompt` in JSON, invalid `timezone`)
- `500` – transcription failures, OpenAI/MCP errors, or unexpected server errors

Errors are returned as JSON:

```json
{
  "message": "..."
}
```
