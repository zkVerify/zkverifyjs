import { ProofType } from '../../../config';
import { TeeVariant } from '../../../enums';
import processor from './index';

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
          tcbResponse: '0xtcb',
          certificates: '0xcertificates',
        },
        options,
      ),
    ).toEqual({
      Intel: {
        tcb_response: '0xtcb',
        certificates: '0xcertificates',
      },
    });
  });

  it('formats verification keys without wrapper for pre-variant runtimes', () => {
    expect(
      processor.formatVk(
        {
          tcbResponse: '0xtcb',
          certificates: '0xcertificates',
        },
        {
          proofType: ProofType.tee,
        },
      ),
    ).toEqual({
      tcbResponse: '0xtcb',
      certificates: '0xcertificates',
    });
  });
});
