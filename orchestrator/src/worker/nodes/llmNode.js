const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const logger = require('../../logger');

// Initialize Groq
const groq = config.GROQ_API_KEY ? new Groq({ apiKey: config.GROQ_API_KEY }) : null;

// Initialize Gemini
const genAI = config.GEMINI_API_KEY ? new GoogleGenerativeAI(config.GEMINI_API_KEY) : null;

const llmNode = {
  async execute(config, inputs) {
    // We expect config.prompt to contain the prompt text.
    // We can replace templated variables from inputs like {{inputKey}}
    let prompt = config.prompt || '';
    
    // Simple template replacement
    for (const [key, val] of Object.entries(inputs)) {
      if (val && typeof val.result === 'string') {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), val.result);
      } else if (val) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), JSON.stringify(val));
      }
    }

    try {
      logger.info('Calling Groq LLM API');
      if (!groq) throw new Error('GROQ_API_KEY is not configured');

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
      });

      return {
        result: chatCompletion.choices[0]?.message?.content || '',
        provider: 'groq'
      };
    } catch (groqError) {
      logger.warn({ err: groqError.message }, 'Groq API call failed. Falling back to Gemini.');

      // Fallback circuit breaker
      try {
        if (!genAI) throw new Error('GEMINI_API_KEY is not configured');
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
          result: text,
          provider: 'gemini',
          fallback_triggered: true
        };
      } catch (geminiError) {
        logger.error({ err: geminiError.message }, 'Gemini fallback also failed');
        throw new Error(`LLM Call failed on both providers. Groq: ${groqError.message}, Gemini: ${geminiError.message}`);
      }
    }
  }
};

module.exports = llmNode;
