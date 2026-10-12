import { ProofType } from '../../../config/index.js';
import { TeeVariant } from '../../../enums.js';
import processor from './index.js';

describe('TEEProcessor', () => {
  const options = {
    proofType: ProofType.tee,
    config: {
      variant: TeeVariant.Intel,
    },
  };

  it('formats verification keys with variant wrapper', () => {
    expect(
      processor.formatVk(
        {
          tcbResponse: '0x7c',
          certificates: '0xce',
        },
        options,
      ),
    ).toEqual({
      Intel: {
        tcb_response: '0x7c',
        certificates: '0xce',
      },
    });
  });

  it('formats verification keys without wrapper for pre-variant runtimes', () => {
    expect(
      processor.formatVk(
        {
          tcbResponse: '0x7c',
          certificates: '0xce',
        },
        {
          proofType: ProofType.tee,
        },
      ),
    ).toEqual({
      tcbResponse: '0x7c',
      certificates: '0xce',
    });
  });
});
