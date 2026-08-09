const logger = require('../../logger');

const conditionNode = {
  async execute(config, inputs) {
    // Config expects { expression: string } like "inputs['node1'].result.includes('yes')"
    // Simple mock logic for evaluating conditions
    const expr = config.expression || 'false';
    logger.info({ expr }, 'Evaluating condition');
    
    // WARNING: In a real production system, do NOT use eval or Function constructor on untrusted input!
    // Using a sandbox library like `vm` or a proper expression parser (e.g., jsep) is strongly recommended.
    // For this prototype/project, we will do a simple isolated Function evaluation:
    try {
      const evaluator = new Function('inputs', `return ${expr};`);
      
      const result = evaluator(inputs);
      return { result: !!result }; // force boolean
    } catch (err) {
      logger.error({ err: err.message, expr }, 'Condition evaluation failed');
      throw new Error(`Failed to evaluate condition: ${err.message}`);
    }
  }
};

module.exports = conditionNode;
