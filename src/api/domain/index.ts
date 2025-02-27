import EventEmitter from 'events';
import { ZkVerifyEvents } from '../../enums';

export const registerDomain = async (
  aggregationSize: number,
  queueSize: number = 16,
  emitter: EventEmitter,
) => {
  if (aggregationSize > 128) throw new Error('aggregationSize must be <= 128');
  if (queueSize > 16) throw new Error('queueSize must be <= 16');

  // Do something to get the domainId
  const domainId = 1;

  emitter.emit(ZkVerifyEvents.NewDomain, { domainId });

  return domainId;
};

export const holdDomain = (domainId: number, emitter: EventEmitter) => {
  // modify state
  // tbd
  const newState = 'Hold'; // placeholder - or 'Removable' depending on pending statements
  // emit event
  emitter.emit(ZkVerifyEvents.DomainStateChanged, {
    domainId,
    newState,
  });
};

export const unregisterDomain = (domainId: number, emitter: EventEmitter) => {
  // modify state
  // tbd
  const newState = 'Removed';
  // emit event
  emitter.emit(ZkVerifyEvents.DomainStateChanged, {
    domainId,
    newState,
  });
};
