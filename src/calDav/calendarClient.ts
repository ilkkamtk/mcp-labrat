import { generateICal, ICalInput } from '@/utils/ical-lib';
import {
  mapIcsToCalendarEvents,
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

const createEvent = async ({
  title,
  start,
  end,
  description,
  location,
}: Omit<ICalInput, 'uid' | 'domain'>) => {
  const client = await getAuthenticatedClient();
  const calendars = await client.fetchCalendars();

  if (calendars.length === 0) {
    throw new Error('No calendars found for the user.');
  }

  const eventData: ICalInput = {
    title,
    start,
    end,
    description,
    location,
  };

  const iCalString = generateICal(eventData);

  await client.createCalendarObject({
    calendar: calendars[0],
    filename: `${Date.now()}.ics`,
    iCalString,
  });

  return { title, start };
};

const listEvents = async () => {
  const client = await getAuthenticatedClient();
  const calendars = await client.fetchCalendars();
  if (calendars.length === 0) return [];

  const events = await client.fetchCalendarObjects({
    calendar: calendars[0],
  });
  return events || [];
};

const getEventsInRange = async (
  start: Date,
  end: Date,
): Promise<CalendarEvent[]> => {
  const client = await getAuthenticatedClient();
  const calendars = await client.fetchCalendars();
  if (calendars.length === 0) return [];

  const events = await client.fetchCalendarObjects({
    calendar: calendars[0],
    timeRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });

  if (!events?.length) return [];

  return events
    .filter((calendarObject) => calendarObject.data)
    .flatMap((calendarObject) => mapIcsToCalendarEvents(calendarObject.data!));
};

export { createEvent, listEvents, getEventsInRange };
