import { proofTypes, curveTypes, libraries } from './common/utils';
import { runAllProofTests, runAllVKRegistrationTests } from "./common/runners";

jest.setTimeout(500000);
describe('zkVerify proof user journey tests', () => {
    test('should verify all proof types without aggregation and respond on finalization', async () => {
        console.log("Verify Test 1: RUNNING 'should verify all proof types without aggregation and respond on finalization'");
        await runAllProofTests(proofTypes, curveTypes, libraries, false);
        console.log("Verify Test 1: COMPLETED");
    });
  test('should verify all proof types using a registered domain and confirm returned aggregationId (No Publish)', async () => {
        console.log("Verify Test 2: Running 'should register a domain, verify all proof types using a domain and confirm returned aggregationId (No Publish)'");
        await runAllProofTests(proofTypes, curveTypes, libraries,true);
        console.log("Verify Test 2: COMPLETED");
    });
    // TODO: New error assuming new functionality "settlementFFlonkPallet.VerificationKeyAlreadyRegistered: Verification key has already been registered."
    test.skip('should register VK and verify the proof using the VK hash for all proof types', async () => {
        await runAllVKRegistrationTests(proofTypes, curveTypes, libraries);
    });
});
