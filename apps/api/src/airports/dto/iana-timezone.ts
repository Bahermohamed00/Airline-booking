import { registerDecorator, type ValidationOptions } from 'class-validator';

/** IANA timezone identifiers known to this runtime (e.g. "Europe/Berlin"). */
const IANA_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

/**
 * Validates an IANA timezone identifier. Flight generation and airport-time
 * math feed this value straight into Intl.DateTimeFormat — an unknown zone
 * would surface later as an unhandled RangeError/500.
 */
export function IsIanaTimeZone(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && IANA_TIMEZONES.has(value),
        defaultMessage: () =>
          'timezone must be a valid IANA timezone identifier (e.g. Europe/Berlin)',
      },
    });
  };
}
