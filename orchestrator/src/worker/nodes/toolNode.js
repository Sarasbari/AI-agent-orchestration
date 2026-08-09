const logger = require('../../logger');

const toolNode = {
  async execute(config, inputs) {
    // Config expects { tool: 'send_email' | 'web_search' | 'db_query', params: object }
    const { tool, params } = config;
    
    logger.info({ tool, params }, 'Executing tool call');

    switch (tool) {
      case 'send_email':
        // stub send_email
        if (!params || !params.to || !params.subject) {
          throw new Error('Missing required params: to, subject');
        }
        return { result: 'Email sent successfully (stub)' };
        
      case 'web_search':
        // stub web_search
        if (!params || !params.query) {
          throw new Error('Missing required param: query');
        }
        return { result: `Mock search results for: ${params.query}` };
        
      case 'db_query':
        // stub db_query
        if (!params || !params.query) {
          throw new Error('Missing required param: query');
        }
        return { result: `Mock DB results for: ${params.query}` };
        
      default:
        throw new Error(`Unsupported tool: ${tool}`);
    }
  }
};

module.exports = toolNode;
