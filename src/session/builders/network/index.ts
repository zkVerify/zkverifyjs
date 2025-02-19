import { WalletOptions, zkVerifySessionOptions } from '../../types';
import { zkVerifySession } from '../../index';
import { SupportedNetwork } from '../../../config';

export type SupportedNetworkMap = {
  [K in keyof typeof SupportedNetwork]: (
    customWsUrl?: string,
  ) => NetworkBuilder;
};

export class NetworkBuilder {
  private options: Partial<zkVerifySessionOptions> = {};

  constructor(
    private readonly startSession: (
      options: zkVerifySessionOptions,
    ) => Promise<zkVerifySession>,
    network: SupportedNetwork,
    customWsUrl?: string,
  ) {
    this.options.host = network;

    if (network === SupportedNetwork.Custom) {
      if (!customWsUrl) {
        throw new Error('Custom network requires a WebSocket URL.');
      }
      this.options.customWsUrl = customWsUrl;
    }
  }

  /**
   * Sets a single seed phrase for a non-browser based session.
   * @param {string} seedPhrase - The seed phrase to use.
   * @returns {Promise<zkVerifySession>} A promise resolving to the session instance.
   */
  withAccount(seedPhrase: string): Promise<zkVerifySession> {
    this.options.seedPhrases = [seedPhrase];
    return this.startSession(this.options as zkVerifySessionOptions);
  }

  /**
   * Sets multiple seed phrases for a non-browser based session.
   * @param {string[]} seedPhrases - An array of seed phrases.
   * @returns {Promise<zkVerifySession>} A promise resolving to the session instance.
   * @throws Will throw an error if fewer than two seed phrases are provided.
   */
  withAccounts(seedPhrases: string[]): Promise<zkVerifySession> {
    if (!Array.isArray(seedPhrases) || seedPhrases.length < 2) {
      throw new Error(
        'withAccounts() requires at least two seed phrases. Use withAccount() for a single account.',
      );
    }

    this.options.seedPhrases = seedPhrases;
    return this.startSession(this.options as zkVerifySessionOptions);
  }

  /**
   * Sets a wallet connection for a browser based session.
   * @param {WalletOptions} wallet - The wallet options to use.
   * @returns {Promise<zkVerifySession>} A promise resolving to the session instance.
   */
  withWallet(wallet: WalletOptions): Promise<zkVerifySession> {
    this.options.wallet = wallet;
    return this.startSession(this.options as zkVerifySessionOptions);
  }

  /**
   * Initializes the session in read-only mode.
   * @returns {Promise<zkVerifySession>} A promise resolving to the session instance.
   */
  readOnly(): Promise<zkVerifySession> {
    return this.startSession(this.options as zkVerifySessionOptions);
  }
}
