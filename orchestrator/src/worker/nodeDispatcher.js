const llmNode = require('./nodes/llmNode');
const conditionNode = require('./nodes/conditionNode');
const toolNode = require('./nodes/toolNode');

const nodeDispatcher = {
  async execute(nodeType, nodeConfig, inputs, userId) {
    switch (nodeType) {
      case 'llm_call':
        return llmNode.execute(nodeConfig, inputs, userId);
      case 'condition':
        return conditionNode.execute(nodeConfig, inputs, userId);
      case 'tool_call':
        return toolNode.execute(nodeConfig, inputs, userId);
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
};

module.exports = nodeDispatcher;
