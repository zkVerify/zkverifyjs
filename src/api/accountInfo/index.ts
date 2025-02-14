import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { AccountInfo as PolkadotAccountInfo } from '@polkadot/types/interfaces/system';
import { AccountInfo } from '../../types';

export async function accountInfo(
  api: ApiPromise,
  account: KeyringPair,
): Promise<AccountInfo> {
  const { nonce, data } = await api.query.system.account<PolkadotAccountInfo>(
    account.address,
  );

  return {
    address: account.address,
    nonce: nonce.toNumber(),
    freeBalance: data.free.toString(),
    reservedBalance: data.reserved.toString(),
  };
}
