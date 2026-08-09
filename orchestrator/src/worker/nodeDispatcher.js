const llmNode = require('./nodes/llmNode');
const conditionNode = require('./nodes/conditionNode');
const toolNode = require('./nodes/toolNode');

const nodeDispatcher = {
  async execute(nodeType, nodeConfig, inputs) {
    switch (nodeType) {
      case 'llm_call':
        return llmNode.execute(nodeConfig, inputs);
      case 'condition':
        return conditionNode.execute(nodeConfig, inputs);
      case 'tool_call':
        return toolNode.execute(nodeConfig, inputs);
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  }
};

module.exports = nodeDispatcher;
