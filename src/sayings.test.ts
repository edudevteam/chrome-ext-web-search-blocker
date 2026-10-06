import { describe, expect, it } from 'vitest';
import { MAX_SAYINGS, parseSayings } from './sayings';

describe('parseSayings', () => {
  it('reads one saying per line and skips blanks', () => {
    expect(parseSayings('First one\n\n  Second one  \r\n')).toEqual([
      { text: 'First one', ref: '' },
      { text: 'Second one', ref: '' },
    ]);
  });

  it('splits off an attribution after an em dash, double hyphen or bar', () => {
    expect(parseSayings('A — B\nC -- D\nE | F')).toEqual([
      { text: 'A', ref: 'B' },
      { text: 'C', ref: 'D' },
      { text: 'E', ref: 'F' },
    ]);
  });

  it('leaves a single hyphen in the text', () => {
    expect(parseSayings('well-known - not a ref')).toEqual([
      { text: 'well-known - not a ref', ref: '' },
    ]);
  });

  it('reads JSON arrays of strings or objects, bare or under "sayings"', () => {
    expect(parseSayings('["One — Me", {"text": "Two", "ref": "You"}]')).toEqual([
      { text: 'One', ref: 'Me' },
      { text: 'Two', ref: 'You' },
    ]);
    expect(parseSayings('{"sayings": [{"text": "Three"}]}')).toEqual([{ text: 'Three', ref: '' }]);
  });

  it('rejects files with nothing usable', () => {
    expect(() => parseSayings('   \n  ')).toThrow('no sayings');
    expect(() => parseSayings('{"other": 1}')).toThrow('list of sayings');
  });

  it('caps the list', () => {
    const lines = Array.from({ length: MAX_SAYINGS + 5 }, (_, i) => `Saying ${i}`).join('\n');
    expect(parseSayings(lines)).toHaveLength(MAX_SAYINGS);
  });
});
