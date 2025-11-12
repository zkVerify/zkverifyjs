import { establishConnection } from '../connection';
import { setupAccount } from '../account';
import { startSession, startWalletSession } from './index';
import { zkVerifySessionOptions } from '../../session/types';
import { SupportedNetwork } from '../../config';
import {
  AccountConnection,
  EstablishedConnection,
  WalletConnection,
} from '../connection/types';
import { KeyringPair } from '@polkadot/keyring/types';
import { InjectedExtension } from '@polkadot/extension-inject/types';

jest.mock('../connection', () => ({
  establishConnection: jest.fn(),
}));
jest.mock('../account', () => ({
  setupAccount: jest.fn(),
}));

jest.mock('@polkadot/extension-dapp', () => ({
  web3Enable: jest.fn(),
  web3Accounts: jest.fn(),
  web3FromSource: jest.fn(),
}));

describe('startSession', () => {
  let mockOptions: zkVerifySessionOptions;
  let mockApi: any;
  let mockProvider: any;

  beforeEach(() => {
    mockApi = { apiProperty: 'apiValue' };
    mockProvider = { providerProperty: 'providerValue' };

    (establishConnection as jest.Mock).mockResolvedValue({
      api: mockApi,
      provider: mockProvider,
      runtimeVersion: {
        specVersion: 1003000,
        specName: 'test-runtime',
      },
    });

    delete (global as any).window;
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it('should return an AccountConnection when a seedPhrase is provided', async () => {
    const mockAccount: jest.Mocked<Partial<KeyringPair>> = {
      address: 'mockAddress',
      meta: { name: 'mockName' },
      isLocked: true,
      sign: jest.fn(),
    };

    (setupAccount as jest.Mock).mockReturnValue(mockAccount);

    mockOptions = {
      networkConfig: {
        host: SupportedNetwork.Volta,
        websocket: 'ws://custom-url',
        rpc: 'http://custom-rpc-url',
        network: SupportedNetwork.Volta,
      },
      seedPhrases: ['testSeedPhrase'],
    };

    const mockAccounts = new Map<string, KeyringPair>();
    mockAccounts.set(mockAccount.address!, mockAccount as KeyringPair);

    const result = await startSession(mockOptions);

    expect(establishConnection).toHaveBeenCalledWith(mockOptions.networkConfig);
    expect(setupAccount).toHaveBeenCalledWith(
      mockOptions.seedPhrases![0],
      false,
    );
    expect(result).toEqual({
      api: mockApi,
      provider: mockProvider,
      accounts: mockAccounts,
      runtimeVersion: {
        specVersion: 1003000,
        specName: 'test-runtime',
      },
    } as AccountConnection);
  });

  it('should throw an error when called in a browser environment', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    mockOptions = {
      networkConfig: {
        host: SupportedNetwork.Volta,
        websocket: 'ws://custom-url',
        rpc: 'http://custom-rpc-url',
      },
    };

    await expect(startSession(mockOptions)).rejects.toThrow(
      'startSession should not be called in a browser environment, use "startWalletSession"',
    );
  });

  it('should return an EstablishedConnection when no seedPhrase is provided', async () => {
    (global as any).window = undefined;

    mockOptions = {
      networkConfig: {
        host: SupportedNetwork.Volta,
        websocket: 'ws://custom-url',
        rpc: 'http://custom-rpc-url',
      },
    };

    const result = await startSession(mockOptions);

    expect(establishConnection).toHaveBeenCalledWith(mockOptions.networkConfig);
    expect(result).toEqual({
      api: mockApi,
      provider: mockProvider,
      runtimeVersion: {
        specVersion: 1003000,
        specName: 'test-runtime',
      },
    } as EstablishedConnection);
  });
});

describe('startWalletSession', () => {
  let mockOptions: zkVerifySessionOptions;
  let mockApi: any;
  let mockProvider: any;

  beforeEach(() => {
    mockApi = { apiProperty: 'apiValue' };
    mockProvider = { providerProperty: 'providerValue' };

    mockOptions = {
      networkConfig: {
        host: SupportedNetwork.Custom,
        websocket: 'ws://custom-url',
        rpc: 'http://custom-rpc-url',
      },
    };

    (establishConnection as jest.Mock).mockResolvedValue({
      api: mockApi,
      provider: mockProvider,
      runtimeVersion: {
        specVersion: 1003000,
        specName: 'test-runtime',
      },
    });

    delete (global as any).window;
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it('should throw an error when called outside of a browser environment', async () => {
    await expect(startWalletSession(mockOptions)).rejects.toThrow(
      'This function must be called in a browser environment, for server side / backend use "startSession"',
    );
  });

  it('should throw an error if wallet object is not provided', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    mockOptions.wallet = undefined;

    await expect(startWalletSession(mockOptions)).rejects.toThrow(
      'Wallet source and accountAddress must be provided.',
    );
  });

  it('should throw an error if wallet source or accountAddress is missing', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    mockOptions.wallet = { source: 'mockSource' } as any;

    await expect(startWalletSession(mockOptions)).rejects.toThrow(
      'Wallet source and accountAddress must be provided.',
    );
  });

  it('should throw an error if no extensions are enabled', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    const { web3Enable } = await import('@polkadot/extension-dapp');
    (web3Enable as jest.Mock).mockResolvedValue([]);

    mockOptions.wallet = {
      source: 'mockSource',
      accountAddress: 'mockAddress',
    };

    await expect(startWalletSession(mockOptions)).rejects.toThrow(
      'No extension installed or access was denied.',
    );
  });

  it('should throw an error if no accounts are found', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    const { web3Enable, web3Accounts } = await import(
      '@polkadot/extension-dapp'
    );
    (web3Enable as jest.Mock).mockResolvedValue([{}]);
    (web3Accounts as jest.Mock).mockResolvedValue([]);

    mockOptions.wallet = {
      source: 'mockSource',
      accountAddress: 'mockAddress',
    };

    await expect(startWalletSession(mockOptions)).rejects.toThrow(
      'No accounts found.',
    );
  });

  it('should throw an error if no account matches the provided wallet source and address', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    const { web3Enable, web3Accounts } = await import(
      '@polkadot/extension-dapp'
    );
    const mockAccounts = [
      { address: 'differentAddress', meta: { source: 'mockSource' } },
    ];

    (web3Enable as jest.Mock).mockResolvedValue([{}]);
    (web3Accounts as jest.Mock).mockResolvedValue(mockAccounts);

    mockOptions.wallet = {
      source: 'mockSource',
      accountAddress: 'mockAddress',
    };

    await expect(startWalletSession(mockOptions)).rejects.toThrow(
      'No account found for wallet source: mockSource and address: mockAddress',
    );
  });

  it('should successfully return a WalletConnection when extensions and accounts are available and match the wallet', async () => {
    Object.defineProperty(global, 'window', { value: {}, writable: true });

    const { web3Enable, web3Accounts, web3FromSource } = await import(
      '@polkadot/extension-dapp'
    );
    const mockAccounts = [
      { address: 'mockAddress', meta: { source: 'mockSource' } },
    ];

    const mockInjector: Partial<InjectedExtension> = {
      name: 'mockExtension',
      version: '1.0.0',
      signer: {
        signPayload: jest.fn(),
        signRaw: jest.fn(),
      },
    };

    (web3Enable as jest.Mock).mockResolvedValue([{}]);
    (web3Accounts as jest.Mock).mockResolvedValue(mockAccounts);
    (web3FromSource as jest.Mock).mockResolvedValue(mockInjector);

    mockOptions.wallet = {
      source: 'mockSource',
      accountAddress: 'mockAddress',
    };

    const result = await startWalletSession(mockOptions);

    expect(establishConnection).toHaveBeenCalledWith(mockOptions.networkConfig);
    expect(web3Enable).toHaveBeenCalledWith('zkVerify');
    expect(web3Accounts).toHaveBeenCalled();
    expect(web3FromSource).toHaveBeenCalledWith('mockSource');

    expect(result).toEqual({
      api: mockApi,
      provider: mockProvider,
      injector: mockInjector,
      accountAddress: 'mockAddress',
      runtimeVersion: {
        specVersion: 1003000,
        specName: 'test-runtime',
      },
    } as WalletConnection);
  });
});
