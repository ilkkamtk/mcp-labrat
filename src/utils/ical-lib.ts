export type ICalInput = {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  uid?: string;
  domain?: string;
};

const escapeText = (str: string): string =>
  str.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');

const toCalDavUTC = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

const generateICal = (input: ICalInput): string => {
  const {
    title,
    start,
    end,
    description,
    location,
    uid,
    domain = 'mcp-server',
  } = input;

  const finalUid = uid || `${crypto.randomUUID()}@${domain}`;
  const now = toCalDavUTC(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Standardized ICal Lib//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${finalUid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toCalDavUTC(start)}`,
    `DTEND:${toCalDavUTC(end)}`,
    `SUMMARY:${escapeText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // Join with CRLF as required by RFC 5545
  return lines.join('\r\n');
};

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Parse iCal date format to readable string with weekday.
 * Handles both UTC (ending with Z) and floating local time formats.
 * Output: "YYYY-MM-DD (Weekday) HH:mm" or "YYYY-MM-DD (Weekday)"
 */
const parseICalDate = (icalDate?: string): string | null => {
  if (!icalDate) return null;

  // Check if this is a UTC timestamp (ends with Z)
  const isUTC = icalDate.endsWith('Z');

  // Handle both YYYYMMDDTHHMMSSZ and YYYYMMDDTHHMMSS formats
  const match = icalDate.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/,
  );
  if (!match) return icalDate;
  const [, year, month, day, hour, minute] = match;

  let date: Date;

  if (isUTC && hour && minute) {
    // UTC time - create Date from UTC and it will auto-convert to local
    date = new Date(
      Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        0,
      ),
    );
  } else {
    // Floating local time - use as-is
    date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hour ? parseInt(hour) : 0,
      minute ? parseInt(minute) : 0,
    );
  }

  const weekday = WEEKDAY_NAMES[date.getDay()];

  if (hour && minute) {
    // Format the local time
    const localHour = date.getHours().toString().padStart(2, '0');
    const localMinute = date.getMinutes().toString().padStart(2, '0');
    const localYear = date.getFullYear();
    const localMonth = (date.getMonth() + 1).toString().padStart(2, '0');
    const localDay = date.getDate().toString().padStart(2, '0');
    return `${localYear}-${localMonth}-${localDay} (${weekday}) ${localHour}:${localMinute}`;
  }
  return `${year}-${month}-${day} (${weekday})`;
};

export { generateICal, parseICalDate };
