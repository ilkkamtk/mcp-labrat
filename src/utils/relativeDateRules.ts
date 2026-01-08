/**
 * Centralized relative date rules and documentation.
 * Single source of truth to avoid drift between MCP tool descriptions and system prompts.
 */

/** Short description of relative date parameters for MCP tool descriptions */
export const RELATIVE_DATE_PARAMS_DESCRIPTION = `- weekOffset: 0 = this week, 1 = next week, -1 = last week, -2 = two weeks ago, etc.
- weekday: The target day of the week (monday-sunday)
- time: Time in HH:mm format (24-hour)
- durationMinutes: Optional duration, defaults to 60 minutes`;

/** Examples of relative date interpretation for MCP tool descriptions */
export const RELATIVE_DATE_EXAMPLES = `Examples:
- "next Monday" = weekOffset: 1, weekday: "monday"
- "this Friday" = weekOffset: 0, weekday: "friday"
- "two weeks from now on Tuesday" = weekOffset: 2, weekday: "tuesday"
- "last Wednesday" = weekOffset: -1, weekday: "wednesday"`;

/** Full MCP tool description for createEvent */
export const CREATE_EVENT_DESCRIPTION = `Create a new calendar event using RELATIVE date specification.
IMPORTANT: Do NOT compute absolute dates. Provide relative date info only.
${RELATIVE_DATE_PARAMS_DESCRIPTION}

${RELATIVE_DATE_EXAMPLES}`;

/** Full MCP tool description for getEventsInTimeSlot */
export const GET_EVENTS_IN_TIME_SLOT_DESCRIPTION = `Get all events within a specific time slot.
Use this tool to check what events exist in a given time range.
Provide relative date parameters to specify the time slot.
weekOffset can be negative for past weeks (e.g., -1 = last week).`;

/** Detailed rules for system prompt - used by LLM to interpret user requests */
export const SYSTEM_PROMPT_DATE_RULES = `CRITICAL DATE RULES - READ CAREFULLY:
1. You must NEVER compute or output absolute dates (like 2026-01-12 or ISO timestamps).
2. For calendar events, you MUST provide ONLY relative date information:
   - weekOffset: number (0 = this week, 1 = next week, -1 = last week, 2 = two weeks from now, etc.)
   - weekday: string (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
   - time: string in HH:mm format (24-hour)

3. Week definition (ISO-8601):
   - Week starts on MONDAY (weekday 1)
   - Week ends on SUNDAY (weekday 7)
   - "This week" means the current Mon-Sun period
   - "Next week" means the NEXT Mon-Sun period (weekOffset: 1)

4. Special case - "tomorrow":
   - Calculate weekOffset and weekday based on what day tomorrow actually is
   - If today is Thursday, tomorrow is Friday → weekOffset: 0, weekday: "friday"
   - If today is Saturday, tomorrow is Sunday → weekOffset: 0, weekday: "sunday"
   - If today is Sunday, tomorrow is Monday → weekOffset: 1, weekday: "monday"

5. Examples of correct interpretation:
   - "next Monday" → weekOffset: 1, weekday: "monday"
   - "next Friday" → weekOffset: 1, weekday: "friday"
   - "this Friday" → weekOffset: 0, weekday: "friday"
   - "two weeks from now on Tuesday" → weekOffset: 2, weekday: "tuesday"
   - "last Wednesday" → weekOffset: -1, weekday: "wednesday"
   - "tomorrow" when today is Thursday → weekOffset: 0, weekday: "friday"

6. The server will calculate the actual date. Your job is ONLY to extract the relative intent.`;
