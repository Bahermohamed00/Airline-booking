import { Transform } from 'class-transformer';

/** Trims and lowercases an email address before validation. */
export function NormalizeEmail() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
}

/** Trims surrounding whitespace before validation. */
export function TrimString() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}
