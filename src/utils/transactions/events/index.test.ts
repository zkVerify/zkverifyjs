import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { EventEmitter } from 'events';
import { handleTransactionEvents } from './index.js';
import {
  TransactionStatus,
  TransactionType,
  ZkVerifyEvents,
} from '../../../enums.js';
import { ProofType } from '../../../config/index.js';
import {
  VerifyTransactionInfo,
  VKRegistrationTransactionInfo,
} from '../../../types.js';
import * as helpers from '../../helpers/index.js';

const api = { registry: {} } as unknown as ApiPromise;

type MockEvent = {
  section: string;
  method: string;
  data: Array<{ toString: () => string }>;
};

const mkPhase = (idx: number) => ({
  isApplyExtrinsic: true,
  asApplyExtrinsic: { toNumber: () => idx },
});

const mkRecord = (
  event: MockEvent,
  extrinsicIndex: number,
): SubmittableResult['events'][number] =>
  ({
    event,
    phase: mkPhase(extrinsicIndex),
  }) as unknown as SubmittableResult['events'][number];

const mkData = (...values: string[]) =>
  values.map((v) => ({ toString: () => v }));

describe('handleTransactionEvents', () => {
  let palletSpy: jest.SpyInstance;

  beforeEach(() => {
    palletSpy = jest
      .spyOn(helpers, 'getProofPallet')
      .mockReturnValue('settlementGroth16Pallet');
  });

  afterEach(() => {
    palletSpy.mockRestore();
  });

  it('emits ProofVerified for a Verify tx when section matches the proof pallet', () => {
    const emitter = new EventEmitter();
    const emitted: Array<{ statement: string }> = [];
    emitter.on(ZkVerifyEvents.ProofVerified, (payload) =>
      emitted.push(payload),
    );

    const info: VerifyTransactionInfo = {
      blockHash: '',
      status: TransactionStatus.InBlock,
      proofType: ProofType.groth16,
      domainId: undefined,
      aggregationId: undefined,
      statement: null,
    };

    const events = [
      mkRecord(
        {
          section: 'settlementGroth16Pallet',
          method: 'ProofVerified',
          data: mkData('0xabc'),
        },
        0,
      ),
    ] as SubmittableResult['events'];

    const result = handleTransactionEvents(
      api,
      events,
      info,
      emitter,
      TransactionType.Verify,
    );

    expect(emitted).toEqual([{ statement: '0xabc' }]);
    expect(result.statement).toBe('0xabc');
  });

  it('emits NewProof for aggregate.NewProof on a Verify tx', () => {
    const emitter = new EventEmitter();
    const emitted: Array<unknown> = [];
    emitter.on(ZkVerifyEvents.NewProof, (payload) => emitted.push(payload));

    const info: VerifyTransactionInfo = {
      blockHash: '',
      status: TransactionStatus.InBlock,
      proofType: ProofType.groth16,
      domainId: undefined,
      aggregationId: undefined,
      statement: null,
    };

    const events = [
      mkRecord(
        {
          section: 'aggregate',
          method: 'NewProof',
          data: mkData('0xdef', '7', '42'),
        },
        0,
      ),
    ] as SubmittableResult['events'];

    const result = handleTransactionEvents(
      api,
      events,
      info,
      emitter,
      TransactionType.Verify,
    );

    expect(emitted).toEqual([
      { statement: '0xdef', domainId: 7, aggregationId: 42 },
    ]);
    expect(result.domainId).toBe(7);
    expect(result.aggregationId).toBe(42);
  });

  it('emits VkRegistered for a VKRegistration tx when section matches the proof pallet', () => {
    const emitter = new EventEmitter();
    const emitted: Array<{ statementHash: string }> = [];
    emitter.on(ZkVerifyEvents.VkRegistered, (payload) => emitted.push(payload));

    const info: VKRegistrationTransactionInfo = {
      blockHash: '',
      status: TransactionStatus.InBlock,
      proofType: ProofType.groth16,
    };

    const events = [
      mkRecord(
        {
          section: 'settlementGroth16Pallet',
          method: 'VkRegistered',
          data: mkData('0xhash'),
        },
        0,
      ),
    ] as SubmittableResult['events'];

    const result = handleTransactionEvents(
      api,
      events,
      info,
      emitter,
      TransactionType.VKRegistration,
    );

    expect(emitted).toEqual([{ statementHash: '0xhash' }]);
    expect(result.statementHash).toBe('0xhash');
  });

  it('looks up the proof pallet at most once per call regardless of event count', () => {
    const emitter = new EventEmitter();
    const info: VerifyTransactionInfo = {
      blockHash: '',
      status: TransactionStatus.InBlock,
      proofType: ProofType.groth16,
      domainId: undefined,
      aggregationId: undefined,
      statement: null,
    };

    const events = Array.from({ length: 50 }, () =>
      mkRecord(
        {
          section: 'system',
          method: 'Other',
          data: mkData('{}'),
        },
        0,
      ),
    ) as SubmittableResult['events'];

    handleTransactionEvents(api, events, info, emitter, TransactionType.Verify);

    expect(palletSpy).toHaveBeenCalledTimes(1);
  });

  it('does not look up the proof pallet for non-proof transaction types', () => {
    const emitter = new EventEmitter();
    const info = {
      blockHash: '',
      status: TransactionStatus.InBlock,
      domainId: undefined,
      domainState: '',
    };

    const events = [
      mkRecord(
        {
          section: 'aggregate',
          method: 'DomainStateChanged',
          data: mkData('3', 'Held'),
        },
        0,
      ),
    ] as SubmittableResult['events'];

    handleTransactionEvents(
      api,
      events,
      info as never,
      emitter,
      TransactionType.DomainHold,
    );

    expect(palletSpy).not.toHaveBeenCalled();
  });
});
