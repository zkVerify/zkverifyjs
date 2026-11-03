import fs from 'fs';
import path from 'path';
import { formatVk } from './index.js';

describe('sp1 formatVk', () => {
  it('accepts the sp1 fixture VK', () => {
    const data = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../../../tests/common/data/sp1.json'),
        'utf8',
      ),
    );
    expect(formatVk(data.vk)).toBe(data.vk);
  });

  it('accepts words just below the BabyBear modulus', () => {
    const vk = '0x' + '78000000'.repeat(8);
    expect(formatVk(vk)).toBe(vk);
  });

  it.each([0, 3, 7])(
    'rejects a VK whose word %i equals the BabyBear modulus',
    (word) => {
      const words = Array(8).fill('00000001');
      words[word] = '78000001';
      expect(() => formatVk('0x' + words.join(''))).toThrow(
        'not a canonical BabyBear digest',
      );
    },
  );

  it('rejects a VK that is not 32 bytes', () => {
    expect(() => formatVk('0x' + '00'.repeat(31))).toThrow('exactly 32 bytes');
  });

  it('rejects non-hex VKs', () => {
    expect(() => formatVk('0xzz')).toThrow('Invalid format');
  });
});
