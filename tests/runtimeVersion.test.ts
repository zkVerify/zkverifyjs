import { zkVerifySession } from '../src';

jest.setTimeout(120000);

describe('Runtime Version Detection', () => {
  let session: zkVerifySession;

  afterEach(async () => {
    if (session) {
      await session.close();
    }
  });

  it('should fetch and store runtime version on Volta connection', async () => {
    console.log('\nTesting Runtime Version Detection on Volta...\n');
    
    session = await zkVerifySession.start().Volta().readOnly();
    
    const runtimeSpec = session.connection.runtimeSpec;
    
    console.log('Runtime Spec Info:');
    console.log('  - specVersion:', runtimeSpec.specVersion);
    console.log('  - specName:', runtimeSpec.specName);
    console.log('');
    
    expect(runtimeSpec).toBeDefined();
    expect(runtimeSpec.specVersion).toBeDefined();
    expect(typeof runtimeSpec.specVersion).toBe('number');
    expect(runtimeSpec.specVersion).toBeGreaterThan(0);
    expect(runtimeSpec.specName).toBeDefined();
    expect(typeof runtimeSpec.specName).toBe('string');
    expect(runtimeSpec.specName.length).toBeGreaterThan(0);
    
    console.log('Runtime version successfully fetched and stored!\n');
  });

  it('should fetch and store runtime version on zkVerify connection', async () => {
    console.log('\nTesting Runtime Version Detection on zkVerify...\n');
    
    session = await zkVerifySession.start().zkVerify().readOnly();
    
    const runtimeSpec = session.connection.runtimeSpec;
    
    console.log('Runtime Spec Info:');
    console.log('  - specVersion:', runtimeSpec.specVersion);
    console.log('  - specName:', runtimeSpec.specName);
    console.log('');
    
    expect(runtimeSpec).toBeDefined();
    expect(runtimeSpec.specVersion).toBeDefined();
    expect(typeof runtimeSpec.specVersion).toBe('number');
    expect(runtimeSpec.specVersion).toBeGreaterThan(0);
    expect(runtimeSpec.specName).toBeDefined();
    expect(typeof runtimeSpec.specName).toBe('string');
    expect(runtimeSpec.specName.length).toBeGreaterThan(0);
    
    console.log('Runtime version successfully fetched and stored!\n');
  });

  it('should correctly show versions for each network', async () => {
    console.log('\nComparing Runtime Versions Between Networks...\n');
    
    const voltaSession = await zkVerifySession.start().Volta().readOnly();
    const zkVerifySession2 = await zkVerifySession.start().zkVerify().readOnly();
    
    const voltaRuntime = voltaSession.connection.runtimeSpec;
    const zkVerifyRuntime = zkVerifySession2.connection.runtimeSpec;
    
    console.log('Volta Runtime:');
    console.log('  - specVersion:', voltaRuntime.specVersion);
    console.log('  - specName:', voltaRuntime.specName);
    console.log('');
    
    console.log('zkVerify Runtime:');
    console.log('  - specVersion:', zkVerifyRuntime.specVersion);
    console.log('  - specName:', zkVerifyRuntime.specName);
    console.log('');
    
    expect(voltaRuntime).toBeDefined();
    expect(zkVerifyRuntime).toBeDefined();
    
    if (voltaRuntime.specVersion !== zkVerifyRuntime.specVersion) {
      console.log('Networks have DIFFERENT runtime versions');
      console.log(`   Volta: ${voltaRuntime.specVersion}, zkVerify: ${zkVerifyRuntime.specVersion}\n`);
    } else {
      console.log('Networks currently have the SAME runtime version');
      console.log(`   Both: ${voltaRuntime.specVersion}\n`);
    }
    
    await voltaSession.close();
    await zkVerifySession2.close();
    
    console.log('Comparison complete!\n');
  });
});

