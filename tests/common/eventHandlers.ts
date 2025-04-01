import { TransactionStatus, TransactionType, ZkVerifyEvents } from '../../src';
import { EventEmitter } from "events";

export interface EventResults {
    includedInBlockEmitted: boolean;
    finalizedEmitted: boolean;
    errorEventEmitted: boolean;
    broadcastEmitted?: boolean;
    unsubscribeEmitted?: boolean;
    newAggregationReceiptEmitted?: boolean;
}

export function createEventTracker() {
    const receivedEvents: Record<string, any[]> = {};

    const attachListeners = (
        emitter: EventEmitter,
        eventsToTrack: ZkVerifyEvents[],
    ) => {
        eventsToTrack.forEach((event) => {
            emitter.on(event, (data) => {
                if (!receivedEvents[event]) {
                    receivedEvents[event] = [];
                }
                receivedEvents[event].push(data);
            });
        });
    };

    return { receivedEvents, attachListeners };
}

const assertCommonFields = (
    eventData: any,
    expectedProofType: string,
    expectedStatus: TransactionStatus,
    expectedType: TransactionType
) => {
    expect(eventData).toBeDefined();
    expect(eventData.blockHash).not.toBeNull();
    expect(eventData.status).toBe(expectedStatus);
    expect(eventData.txHash).toBeDefined();

    if (
        expectedType === TransactionType.Verify ||
        expectedType === TransactionType.VKRegistration
    ) {
        expect(eventData.proofType).toBe(expectedProofType);
    } else {
        expect(eventData.proofType).toBeUndefined();
    }
};

const assertVerifyEventData = (eventData: any, expectAggregationData: boolean) => {
    expect(eventData.statement).toBeDefined();

    if (expectAggregationData) {
        expect(eventData.domainId).toBeDefined();
        expect(eventData.aggregationId).toBeDefined();
    } else {
        expect(eventData.domainId).toBeUndefined();
        expect(eventData.aggregationId).toBeUndefined();
    }

    expect(eventData.statementHash).toBeUndefined();
};

const assertVKRegistrationEventData = (eventData: any) => {
    expect(eventData.statementHash).toBeDefined();
    expect(eventData.statement).toBeUndefined();
    expect(eventData.domainId).toBeUndefined();
    expect(eventData.aggregationId).toBeUndefined();
};

const assertDomainEventData = (eventData: any, expectedType: TransactionType) => {
    expect(eventData.domainId).toBeDefined();

    if (expectedType === TransactionType.DomainHold || expectedType === TransactionType.DomainUnregister) {
        expect(eventData.domainState).toBeDefined();
    }

    expect(eventData.statementHash).toBeUndefined();
    expect(eventData.statement).toBeUndefined();
    expect(eventData.aggregationId).toBeUndefined();
};

const assertAggregateEventData = (eventData: any) => {
    expect(eventData.domainId).toBeDefined();
    expect(eventData.aggregationId).toBeDefined();
    expect(eventData.receipt).toBeDefined();
};

const assertEventDataByType = (
    eventData: any,
    expectedType: TransactionType,
    expectAggregationData: boolean,
) => {
    switch (expectedType) {
        case TransactionType.Verify:
            assertVerifyEventData(eventData, expectAggregationData);
            break;
        case TransactionType.VKRegistration:
            assertVKRegistrationEventData(eventData);
            break;
        case TransactionType.DomainRegistration:
        case TransactionType.DomainHold:
        case TransactionType.DomainUnregister:
            assertDomainEventData(eventData, expectedType);
            break;
        case TransactionType.Aggregate:
            assertAggregateEventData(eventData);
            break;
        default:
            throw new Error(`Unsupported TransactionType: ${expectedType}`);
    }
};

export const handleCommonEvents = (
    events: any,
    expectedProofType: string,
    expectedDataType: TransactionType,
    expectAggregationData: boolean = false,
): EventResults => {
    const eventResults: EventResults = {
        includedInBlockEmitted: false,
        finalizedEmitted: false,
        errorEventEmitted: false,
        broadcastEmitted: false,
        unsubscribeEmitted: false,
    };

    const assertionErrors: Error[] = [];

    events.on(ZkVerifyEvents.ErrorEvent, () => {
        eventResults.errorEventEmitted = true;
    });

    events.on(ZkVerifyEvents.IncludedInBlock, (eventData: any) => {
        eventResults.includedInBlockEmitted = true;
        try {
            assertCommonFields(eventData, expectedProofType, TransactionStatus.InBlock, expectedDataType);
            assertEventDataByType(eventData, expectedDataType, expectAggregationData);
        } catch (error) {
            assertionErrors.push(error as Error);
        }
    });

    events.on(ZkVerifyEvents.Finalized, (eventData: any) => {
        eventResults.finalizedEmitted = true;
        try {
            assertCommonFields(eventData, expectedProofType, TransactionStatus.Finalized, expectedDataType);
            assertEventDataByType(eventData, expectedDataType, expectAggregationData);
        } catch (error) {
            assertionErrors.push(error as Error);
        }
    });

    events.on(ZkVerifyEvents.Broadcast, (eventData: any) => {
        eventResults.broadcastEmitted = true;
        try {
            expect(eventData).toBeDefined();
            expect(eventData.txHash).toBeDefined();
        } catch (error) {
            assertionErrors.push(error as Error);
        }
    });

    events.on(ZkVerifyEvents.Unsubscribe, () => {
        eventResults.unsubscribeEmitted = true;
    });

    setTimeout(() => {
        if (assertionErrors.length > 0) {
            const message = assertionErrors.map((e, i) => `#${i + 1}: ${e.message}`).join('\n');
            throw new Error(`Assertion(s) failed in event handlers:\n${message}`);
        }
    }, 0);

    return eventResults;
};
