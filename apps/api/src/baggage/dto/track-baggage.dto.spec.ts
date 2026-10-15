import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TrackBaggageParamsDto } from './track-baggage.dto';

const validateTag = async (tagNumber: unknown) =>
  validate(plainToInstance(TrackBaggageParamsDto, { tagNumber }));

describe('TrackBaggageParamsDto', () => {
  it('accepts normal tags and normalizes case/whitespace', async () => {
    const dto = plainToInstance(TrackBaggageParamsDto, { tagNumber: '  nv00000001 ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.tagNumber).toBe('NV00000001');
  });

  it.each([
    ['too short', 'NV1'],
    ['too long', 'NV' + '1'.repeat(30)],
    ['symbols', 'NV0000-001'],
    ['empty', ''],
    ['whitespace only', '   '],
    ['non-string', 42],
  ])('rejects %s', async (_label, tag) => {
    const errors = await validateTag(tag);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.property).toBe('tagNumber');
  });
});
