import { formatUTC, formatFloating } from './dateUtils';

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
  const now = formatUTC(new Date());

  // taulukon käyttö helpottaa luettavuutta ja valinnaiten kenttien käsittelyä
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Standardized ICal Lib//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${finalUid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatFloating(start)}`,
    `DTEND:${formatFloating(end)}`,
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

export { generateICal };
