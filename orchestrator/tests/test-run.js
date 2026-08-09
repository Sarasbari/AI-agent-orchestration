const testRun = async () => {
  try {
    console.log('1. Signing up a test user...');
    const signupRes = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `test-${Date.now()}@example.com`, password: 'Password123!' })
    });
    
    if (!signupRes.ok) {
      console.log(await signupRes.text());
      throw new Error('Signup failed');
    }
    const { accessToken } = await signupRes.json();
    console.log('User created and authenticated.');

    console.log('\n2. Creating a workflow...');
    const workflowDef = {
      name: 'Test Workflow',
      dag_definition: {
        nodes: [
          { id: 'n1', type: 'tool_call', config: { tool: 'web_search', params: { query: 'AI trends' } } }
        ],
        edges: []
      }
    };
    
    const wfRes = await fetch('http://localhost:3000/api/workflows', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(workflowDef)
    });
    
    const workflow = await wfRes.json();
    console.log('Workflow Creation Response:', workflow);

    console.log('\n3. Triggering the workflow run...');
    const runRes = await fetch(`http://localhost:3000/api/workflows/${workflow.id}/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const run = await runRes.json();
    console.log('Run Trigger Response:', run);
    
    console.log('\n4. Waiting 3 seconds for the worker to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n5. Check your orchestrator/worker terminal logs to see if it processed!');
    
  } catch (error) {
    console.error(error);
  }
};

testRun();
