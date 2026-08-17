const llmNode = require('../src/worker/nodes/llmNode');
const conditionNode = require('../src/worker/nodes/conditionNode');
const toolNode = require('../src/worker/nodes/toolNode');
const nodeDispatcher = require('../src/worker/nodeDispatcher');

// Mock external LLM SDKs
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked Groq Response' } }]
          })
        }
      }
    };
  });
});

jest.mock('../src/db/pool', () => ({
  query: jest.fn().mockResolvedValue({
    rows: [{ provider: 'groq', encrypted_key: 'mock-encrypted-groq' }]
  })
}));

jest.mock('../src/services/encryptionService', () => ({
  decrypt: jest.fn().mockReturnValue('mock-decrypted-key')
}));

describe('Worker Node Execution Logic', () => {
  describe('Condition Node', () => {
    it('evaluates true condition correctly', async () => {
      const config = { expression: "inputs['n1'].result === 'yes'" };
      const inputs = { n1: { result: 'yes' } };
      const output = await conditionNode.execute(config, inputs);
      expect(output.result).toBe(true);
    });

    it('evaluates false condition correctly', async () => {
      const config = { expression: "inputs['n1'].result === 'yes'" };
      const inputs = { n1: { result: 'no' } };
      const output = await conditionNode.execute(config, inputs);
      expect(output.result).toBe(false);
    });
  });

  describe('Tool Node', () => {
    it('executes send_email stub', async () => {
      const config = { tool: 'send_email', params: { to: 'test@example.com', subject: 'hi' } };
      const output = await toolNode.execute(config, {});
      expect(output.result).toContain('Email sent');
    });

    it('throws error on missing params', async () => {
      const config = { tool: 'send_email', params: {} };
      await expect(toolNode.execute(config, {})).rejects.toThrow(/Missing required params/);
    });
  });

  describe('Node Dispatcher', () => {
    it('dispatches to correct node logic', async () => {
      jest.spyOn(conditionNode, 'execute').mockResolvedValue({ result: true });
      const output = await nodeDispatcher.execute('condition', { expression: 'true' }, {});
      expect(output.result).toBe(true);
      expect(conditionNode.execute).toHaveBeenCalled();
    });

    it('throws error on unknown node type', async () => {
      await expect(nodeDispatcher.execute('unknown_type', {}, {})).rejects.toThrow(/Unknown node type/);
    });
  });

  describe('LLM Node', () => {
    it('returns mocked Groq response by default', async () => {
      const config = { prompt: 'Hello {{n1}}' };
      const inputs = { n1: { result: 'World' } };
      const output = await llmNode.execute(config, inputs, 'user-1');
      
      expect(output.provider).toBe('groq');
      expect(output.result).toBe('Mocked Groq Response');
    });
  });
});
