# mcp-labrat

# mcp-labrat

## MCP server

This project exposes an MCP server over Streamable HTTP at:

- `POST /api/v1/mcp`

## MCP client (OpenAI)

This project also exposes an HTTP endpoint that accepts a text prompt and uses the OpenAI API with tool-calling to invoke the MCP server tools:

- `POST /api/v1/client`

Request body:

```json
{ "prompt": "List my events" }
```

Response includes:

- `answer`: final assistant text
- `toolTrace`: ordered list of MCP tool calls (name/args/output)

Environment variables:

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default: `gpt-4.1-mini`)
- `MCP_SERVER_URL` (optional, default: `http://localhost:$PORT/api/v1/mcp`)
