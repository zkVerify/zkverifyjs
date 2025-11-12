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
    
    const runtimeVersion = (session as any).connectionManager.runtimeVersion;
    
    console.log('Runtime Version Info:');
    console.log('  - specVersion:', runtimeVersion?.specVersion);
    console.log('  - specName:', runtimeVersion?.specName);
    console.log('');
    
    expect(runtimeVersion).not.toBeNull();
    expect(runtimeVersion?.specVersion).toBeDefined();
    expect(typeof runtimeVersion?.specVersion).toBe('number');
    expect(runtimeVersion?.specVersion).toBeGreaterThan(0);
    expect(runtimeVersion?.specName).toBeDefined();
    expect(typeof runtimeVersion?.specName).toBe('string');
    expect(runtimeVersion?.specName.length).toBeGreaterThan(0);
    
    console.log('Runtime version successfully fetched and stored!\n');
  });

  it('should fetch and store runtime version on zkVerify connection', async () => {
    console.log('\nTesting Runtime Version Detection on zkVerify...\n');
    
    session = await zkVerifySession.start().zkVerify().readOnly();
    
    const runtimeVersion = (session as any).connectionManager.runtimeVersion;
    
    console.log('Runtime Version Info:');
    console.log('  - specVersion:', runtimeVersion?.specVersion);
    console.log('  - specName:', runtimeVersion?.specName);
    console.log('');
    
    expect(runtimeVersion).not.toBeNull();
    expect(runtimeVersion?.specVersion).toBeDefined();
    expect(typeof runtimeVersion?.specVersion).toBe('number');
    expect(runtimeVersion?.specVersion).toBeGreaterThan(0);
    expect(runtimeVersion?.specName).toBeDefined();
    expect(typeof runtimeVersion?.specName).toBe('string');
    expect(runtimeVersion?.specName.length).toBeGreaterThan(0);
    
    console.log('Runtime version successfully fetched and stored!\n');
  });

  it('should show different versions between networks', async () => {
    console.log('\nComparing Runtime Versions Between Networks...\n');
    
    const voltaSession = await zkVerifySession.start().Volta().readOnly();
    const zkVerifySession2 = await zkVerifySession.start().zkVerify().readOnly();
    
    const voltaRuntime = (voltaSession as any).connectionManager.runtimeVersion;
    const zkVerifyRuntime = (zkVerifySession2 as any).connectionManager.runtimeVersion;
    
    console.log('Volta Runtime:');
    console.log('  - specVersion:', voltaRuntime?.specVersion);
    console.log('  - specName:', voltaRuntime?.specName);
    console.log('');
    
    console.log('zkVerify Runtime:');
    console.log('  - specVersion:', zkVerifyRuntime?.specVersion);
    console.log('  - specName:', zkVerifyRuntime?.specName);
    console.log('');
    
    expect(voltaRuntime).not.toBeNull();
    expect(zkVerifyRuntime).not.toBeNull();
    
    if (voltaRuntime?.specVersion !== zkVerifyRuntime?.specVersion) {
      console.log('Networks have DIFFERENT runtime versions');
      console.log(`   Volta: ${voltaRuntime?.specVersion}, zkVerify: ${zkVerifyRuntime?.specVersion}\n`);
    } else {
      console.log('Networks currently have the SAME runtime version');
      console.log(`   Both: ${voltaRuntime?.specVersion}\n`);
    }
    
    await voltaSession.close();
    await zkVerifySession2.close();
    
    console.log('Comparison complete!\n');
  });
});

