import { generateICal, ICalInput } from '@/utils/ical-lib';
import {
  parseCalendarObjects,
  type CalendarEvent,
} from '@/utils/calendar-events';
import { DAVClient } from 'tsdav';

const CALDAV_SERVER_URL =
  process.env.CALDAV_SERVER_URL ?? 'http://localhost:5232/';
const CALDAV_USERNAME = process.env.CALDAV_USERNAME ?? 'username';
const CALDAV_PASSWORD = process.env.CALDAV_PASSWORD ?? 'password';

let clientPromise: Promise<DAVClient> | null = null;

const getAuthenticatedClient = () => {
  // If a login is already in progress or finished, return that same promise
  if (clientPromise) return clientPromise;

  // Otherwise, create the promise and store it
  clientPromise = (async () => {
    const client = new DAVClient({
      serverUrl: CALDAV_SERVER_URL,
      credentials: { username: CALDAV_USERNAME, password: CALDAV_PASSWORD },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    try {
      await client.login();
      return client;
    } catch (error) {
      clientPromise = null; // Reset so we can try again later
      throw error;
    }
  })();

  return clientPromise;
};

/**
 * Get the primary (first) calendar for the authenticated user.
 * Shared helper to avoid duplicating calendar fetching logic.
 * @throws Error if no calendars are found
 */
const getPrimaryCalendar = async () => {
  const client = await getAuthenticatedClient();
  const calendars = await client.fetchCalendars();

  if (calendars.length === 0) {
    throw new Error('No calendars found for the user.');
  }

  return { client, calendar: calendars[0] };
};

const createEvent = async ({
  title,
  start,
  end,
  description,
  location,
}: Omit<ICalInput, 'uid' | 'domain'>) => {
  const { client, calendar } = await getPrimaryCalendar();

  const eventData: ICalInput = {
    title,
    start,
    end,
    description,
    location,
  };

  const iCalString = generateICal(eventData);

  await client.createCalendarObject({
    calendar,
    filename: `${Date.now()}.ics`,
    iCalString,
  });

  return { title, start };
};

const listEvents = async () => {
  try {
    const { client, calendar } = await getPrimaryCalendar();
    const events = await client.fetchCalendarObjects({ calendar });
    return events || [];
  } catch {
    // Return empty array if no calendars found
    return [];
  }
};

const getEventsInRange = async (
  start: Date,
  end: Date,
): Promise<CalendarEvent[]> => {
  try {
    const { client, calendar } = await getPrimaryCalendar();

    const events = await client.fetchCalendarObjects({
      calendar,
      timeRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });

    if (!events?.length) return [];

    return parseCalendarObjects(events);
  } catch {
    // Return empty array if no calendars found
    return [];
  }
};

export { createEvent, listEvents, getEventsInRange };
