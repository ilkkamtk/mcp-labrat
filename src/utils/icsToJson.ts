// source: https://github.com/cwlsn/ics-to-json

const NEW_LINE = /\r\n|\n|\r/;

const EVENT = 'VEVENT';
const EVENT_START = 'BEGIN';
const EVENT_END = 'END';
const START_DATE = 'DTSTART';
const END_DATE = 'DTEND';
const DESCRIPTION = 'DESCRIPTION';
const SUMMARY = 'SUMMARY';
const LOCATION = 'LOCATION';
const ALARM = 'VALARM';

const keyMap = {
  [START_DATE]: 'startDate',
  [END_DATE]: 'endDate',
  [DESCRIPTION]: 'description',
  [SUMMARY]: 'summary',
  [LOCATION]: 'location',
} as const;

type KeyMapKey = keyof typeof keyMap;
type ICSJson = Record<string, string>;

const clean = (string: string | undefined): string => {
  if (string == undefined) {
    return '';
  }
  // Wrap decodeURI in try/catch since ICS values aren't guaranteed to be URI-encoded
  try {
    return decodeURI(string).trim();
  } catch {
    return string.trim();
  }
};

export const icsToJson = (icsData: string): ICSJson[] => {
  const array: ICSJson[] = [];
  let currentObj: ICSJson = {};
  let lastKey = '';

  const lines = icsData.split(NEW_LINE);

  let isAlarm = false;
  for (let i = 0, iLen = lines.length; i < iLen; ++i) {
    const line = lines[i] ?? '';
    // Split only on the first colon to preserve values containing ':' (e.g., URLs, descriptions)
    const colonIndex = line.indexOf(':');
    const key = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const value = colonIndex === -1 ? '' : line.slice(colonIndex + 1);

    let parsedKey = key;

    if (parsedKey && parsedKey.indexOf(';') !== -1) {
      const keyParts = parsedKey.split(';');
      parsedKey = keyParts[0] ?? parsedKey;
      // Maybe do something with that second part later
    }

    if (parsedKey) {
      if (colonIndex === -1) {
        if (
          parsedKey.startsWith(' ') &&
          lastKey !== undefined &&
          lastKey.length > 0
        ) {
          currentObj[lastKey] += clean(line.substring(1));
        }
      } else if (parsedKey in keyMap) {
        lastKey = keyMap[parsedKey as KeyMapKey];
      }
    }

    switch (parsedKey) {
      case EVENT_START:
        if (value === EVENT) {
          currentObj = {};
        } else if (value === ALARM) {
          isAlarm = true;
        }
        break;
      case EVENT_END:
        isAlarm = false;
        if (value === EVENT) array.push(currentObj);
        break;
      case START_DATE:
        currentObj[keyMap[START_DATE]] = value;
        break;
      case END_DATE:
        currentObj[keyMap[END_DATE]] = value;
        break;
      case DESCRIPTION:
        if (!isAlarm) currentObj[keyMap[DESCRIPTION]] = clean(value);
        break;
      case SUMMARY:
        currentObj[keyMap[SUMMARY]] = clean(value);
        break;
      case LOCATION:
        currentObj[keyMap[LOCATION]] = clean(value);
        break;
      default:
        continue;
    }
  }
  return array;
};
