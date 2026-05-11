import { jest, describe, it, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { ApiPromise, SubmittableResult } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { KeyringPair } from '@polkadot/keyring/types';
import { ProofType } from '../../config';
import { TransactionStatus, TransactionType } from '../../enums';
import { VerifyOptions } from '../../session/types';
import { handleTransaction } from './index';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('handleTransaction', () => {
  const finalizedResult = {
    status: {
      isBroadcast: false,
      isInBlock: false,
      isFinalized: true,
      isInvalid: false,
    },
    dispatchError: undefined,
    events: [],
  } as unknown as SubmittableResult;

  it('invokes a late-arriving signAndSend unsubscribe after finalization', async () => {
    let capturedCallback!: (result: SubmittableResult) => Promise<void>;
    let resolveUnsubscribe!: (fn: () => void) => void;
    const unsubscribe = jest.fn();

    const submitExtrinsic = {
      signAndSend: jest.fn(
        (
          _account: KeyringPair,
          _options: unknown,
          callback: (result: SubmittableResult) => Promise<void>,
        ) => {
          capturedCallback = callback;
          return new Promise<() => void>((resolve) => {
            resolveUnsubscribe = resolve;
          });
        },
      ),
    } as unknown as SubmittableExtrinsic<'promise'>;

    const transactionPromise = handleTransaction(
      {} as ApiPromise,
      submitExtrinsic,
      {} as KeyringPair,
      undefined,
      new EventEmitter(),
      {
        proofOptions: { proofType: ProofType.groth16 },
      } as VerifyOptions,
      TransactionType.Verify,
    );

    await capturedCallback(finalizedResult);

    await expect(transactionPromise).resolves.toEqual(
      expect.objectContaining({ status: TransactionStatus.Finalized }),
    );
    expect(unsubscribe).not.toHaveBeenCalled();

    resolveUnsubscribe(unsubscribe);
    await flushMicrotasks();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cleans up many concurrent transactions with late signAndSend unsubscribe fns', async () => {
    const transactionCount = 250;
    const capturedCallbacks: Array<
      (result: SubmittableResult) => Promise<void>
    > = [];
    const resolveUnsubscribes: Array<(fn: () => void) => void> = [];
    const unsubscribeFns = Array.from({ length: transactionCount }, () =>
      jest.fn(),
    );

    const makeSubmitExtrinsic = (index: number) =>
      ({
        signAndSend: jest.fn(
          (
            _account: KeyringPair,
            _options: unknown,
            callback: (result: SubmittableResult) => Promise<void>,
          ) => {
            capturedCallbacks[index] = callback;
            return new Promise<() => void>((resolve) => {
              resolveUnsubscribes[index] = resolve;
            });
          },
        ),
      }) as unknown as SubmittableExtrinsic<'promise'>;

    const transactionPromises = Array.from(
      { length: transactionCount },
      (_, index) =>
        handleTransaction(
          {} as ApiPromise,
          makeSubmitExtrinsic(index),
          {} as KeyringPair,
          undefined,
          new EventEmitter(),
          {
            proofOptions: { proofType: ProofType.groth16 },
          } as VerifyOptions,
          TransactionType.Verify,
        ),
    );

    await Promise.all(
      capturedCallbacks.map((callback) => callback(finalizedResult)),
    );
    await expect(Promise.all(transactionPromises)).resolves.toHaveLength(
      transactionCount,
    );
    expect(
      unsubscribeFns.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 0,
      ),
    ).toBe(true);

    resolveUnsubscribes.forEach((resolve, index) =>
      resolve(unsubscribeFns[index]),
    );
    await flushMicrotasks();

    expect(
      unsubscribeFns.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
});
