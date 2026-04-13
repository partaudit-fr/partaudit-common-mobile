import type { ErrorCode } from './errorCodes';

type ErrorMessages = Record<string, Record<string, string>>;

let errorMessages: ErrorMessages = {};
let currentLocale: 'fr' | 'en' = 'fr';

/**
 * Initialize the error message translations.
 * Must be called once at app startup with your i18n error maps.
 *
 * @example
 * import fr from '@partaudit/shared/i18n/fr.json';
 * import en from '@partaudit/shared/i18n/en.json';
 * initErrorMessages({ fr: fr.errors, en: en.errors });
 */
export function initErrorMessages(messages: ErrorMessages) {
  errorMessages = messages;
}

export function setErrorLocale(locale: string) {
  currentLocale = locale === 'en' ? 'en' : 'fr';
}

export function getErrorTranslation(code: ErrorCode): string | undefined {
  const map = errorMessages[currentLocale] || errorMessages['fr'] || {};
  return map[code];
}

/**
 * Extracts a human-readable error message from various error formats.
 * Supports structured {code, message, status} and legacy formats.
 */
export function parseErrorMessage(
  error: unknown,
  defaultMessage: string = getErrorTranslation('INTERNAL_ERROR' as ErrorCode) || "Une erreur s'est produite",
): string {
  if (!error) {
    return defaultMessage;
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (typeof parsed === 'object' && parsed !== null) {
        return extractMessageFromObject(parsed) || defaultMessage;
      }
    } catch {
      // Not JSON
    }
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    return extractMessageFromObject(error as Record<string, unknown>) || defaultMessage;
  }

  return defaultMessage;
}

function extractMessageFromObject(obj: Record<string, unknown>): string | null {
  // Structured format: {code, message, status}
  if (typeof obj.code === 'string' && typeof obj.message === 'string') {
    const code = obj.code as ErrorCode;
    return obj.message || getErrorTranslation(code) || null;
  }

  // Direct message property
  if (typeof obj.message === 'string' && obj.message.trim()) {
    try {
      const parsed = JSON.parse(obj.message);
      if (typeof parsed === 'object' && parsed !== null) {
        const nestedMessage = extractMessageFromObject(parsed as Record<string, unknown>);
        if (nestedMessage) return nestedMessage;
      }
    } catch {
      // Not JSON
    }
    return obj.message;
  }

  // Message is an object
  if (typeof obj.message === 'object' && obj.message !== null) {
    const msgObj = obj.message as Record<string, unknown>;
    if (typeof msgObj.message === 'string') return msgObj.message;
    if (typeof msgObj.text === 'string') return msgObj.text;
  }

  if (typeof obj.error === 'string' && obj.error.trim()) {
    return obj.error;
  }

  if (typeof obj.error === 'object' && obj.error !== null) {
    const nestedMessage = extractMessageFromObject(obj.error as Record<string, unknown>);
    if (nestedMessage) return nestedMessage;
  }

  if (typeof obj.statusText === 'string' && obj.statusText.trim()) {
    return obj.statusText;
  }

  if (typeof obj.reason === 'string' && obj.reason.trim()) {
    return obj.reason;
  }

  return null;
}
