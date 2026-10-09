import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { optimisticVerify } from './index.js';
import { ProofType } from '../../config/index.js';
import { AccountConnection } from '../connection/types.js';
import { OptimisticVerifyOptions } from '../../session/types.js';
import { VerifyInput } from '../verify/types.js';

jest.mock('../format/index.js', () => ({
  format: jest.fn().mockReturnValue({
    formattedVk: 'vk',
    formattedProof: 'proof',
    formattedPubs: 'pubs',
  }),
}));

jest.mock('../extrinsic/index.js', () => ({
  createSubmitProofExtrinsic: jest.fn(() => mockTransaction),
}));

jest.mock('../../utils/helpers/index.js', () => ({
  getKeyringAccountIfAvailable: jest.fn(() => mockAccount),
  interpretDryRunResponse: jest.fn(() => ({
    success: true,
    type: 'ok',
    message: 'ok',
  })),
  toSubmittableExtrinsic: jest.fn(() => mockTransaction),
}));

const mockTransaction = {
  signAsync: jest.fn().mockResolvedValue(undefined),
  toHex: jest.fn().mockReturnValue('0xsignedpayload'),
};

const mockAccount = { address: '5Fake' } as unknown as KeyringPair;

const makeApi = () =>
  ({
    rpc: {
      chain: {
        getHeader: jest.fn().mockResolvedValue({
          number: { toNumber: () => 1000 },
          parentHash: { toHex: () => '0xparenthash' },
        }),
        getBlockHash: jest.fn().mockResolvedValue({
          toHex: () => '0xhashofblock500',
        }),
      },
      system: {
        dryRun: jest.fn().mockResolvedValue({ toHex: () => '0xdryrunresult' }),
      },
    },
    registry: {
      createType: jest.fn((type: string, value: unknown) => ({ type, value })),
    },
  }) as unknown as ApiPromise;

const baseOptions: OptimisticVerifyOptions = {
  proofOptions: { proofType: ProofType.groth16 },
};

const input: VerifyInput = {
  proofData: { proof: 'p', publicSignals: ['1'], vk: 'v' },
} as VerifyInput;

describe('optimisticVerify signing', () => {
  let api: ApiPromise;
  let connection: AccountConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.signAsync.mockResolvedValue(undefined);
    mockTransaction.toHex.mockReturnValue('0xsignedpayload');
    api = makeApi();
    connection = {
      api,
      accounts: new Map([['5Fake', mockAccount]]),
    } as unknown as AccountConnection;
  });

  const signOptions = () => mockTransaction.signAsync.mock.calls[0][1];

  // `system.dryRun` verifies the signature, so a real signed extrinsic is transmitted
  // to the RPC endpoint. An immortal era (`era: 0`) would leave that payload valid
  // forever — replayable by the endpoint or anyone observing it, since the caller only
  // dry-ran and never consumed the nonce.
  it('never signs the dry-run payload with an immortal era', async () => {
    await optimisticVerify(connection, baseOptions, input);

    expect(mockTransaction.signAsync).toHaveBeenCalledTimes(1);
    expect(signOptions()).not.toHaveProperty('era', 0);
  });

  it('omits era when dry-running against the current head, so polkadot-js applies its default mortal era', async () => {
    const result = await optimisticVerify(connection, baseOptions, input);

    expect(result.success).toBe(true);
    expect(signOptions()).toEqual({ nonce: -1 });
    expect(signOptions().era).toBeUndefined();
    // dryRun at head takes no block hash
    expect(api.rpc.system.dryRun).toHaveBeenCalledWith('0xsignedpayload');
  });

  it("anchors a short mortal era at the pinned block's parent", async () => {
    await optimisticVerify(connection, { ...baseOptions, block: 500 }, input);

    expect(api.rpc.chain.getBlockHash).toHaveBeenCalledWith(500);
    expect(api.rpc.chain.getHeader).toHaveBeenCalledWith('0xhashofblock500');

    // Era is anchored at the parent of the block being executed against: state at
    // the pinned block only holds hashes of earlier blocks, so anchoring at the block
    // itself would fail the runtime's mortality check.
    expect(api.registry.createType).toHaveBeenCalledWith('ExtrinsicEra', {
      current: 999,
      period: 64,
    });

    const opts = signOptions();
    expect(opts.nonce).toBe(-1);
    expect(opts.blockHash).toBe('0xparenthash');
    expect(opts.era).toEqual({
      type: 'ExtrinsicEra',
      value: { current: 999, period: 64 },
    });

    expect(api.rpc.system.dryRun).toHaveBeenCalledWith(
      '0xsignedpayload',
      '0xhashofblock500',
    );
  });

  it('accepts a block hash string without resolving it', async () => {
    await optimisticVerify(
      connection,
      { ...baseOptions, block: '0xgivenhash' },
      input,
    );

    expect(api.rpc.chain.getBlockHash).not.toHaveBeenCalled();
    expect(api.rpc.chain.getHeader).toHaveBeenCalledWith('0xgivenhash');
    expect(signOptions().blockHash).toBe('0xparenthash');
    expect(api.rpc.system.dryRun).toHaveBeenCalledWith(
      '0xsignedpayload',
      '0xgivenhash',
    );
  });

  it('anchors at genesis itself when the pinned block is genesis', async () => {
    (api.rpc.chain.getHeader as unknown as jest.Mock).mockResolvedValueOnce({
      number: { toNumber: () => 0 },
      parentHash: { toHex: () => '0x00' },
    });

    await optimisticVerify(
      connection,
      { ...baseOptions, block: '0xgenesishash' },
      input,
    );

    expect(api.registry.createType).toHaveBeenCalledWith('ExtrinsicEra', {
      current: 0,
      period: 64,
    });
    expect(signOptions().blockHash).toBe('0xgenesishash');
  });

  it('honours an explicit nonce', async () => {
    await optimisticVerify(connection, { ...baseOptions, nonce: 7 }, input);

    expect(signOptions().nonce).toBe(7);
  });

  it('reports a transport error rather than throwing when signing fails', async () => {
    mockTransaction.signAsync.mockRejectedValueOnce(new Error('sign boom'));

    const result = await optimisticVerify(connection, baseOptions, input);

    expect(result.success).toBe(false);
    expect(result.message).toContain('sign boom');
  });
});
