const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../logger');
const { query } = require('../../db/pool');
const encryptionService = require('../../services/encryptionService');

const llmNode = {
  async execute(config, inputs, userId) {
    // 1. Fetch user API keys
    const keysResult = await query(
      `SELECT provider, encrypted_key FROM api_keys WHERE user_id = $1 AND provider IN ('groq', 'gemini')`,
      [userId]
    );
    
    let groqKey = null;
    let geminiKey = null;
    
    for (const row of keysResult.rows) {
      try {
        if (row.provider === 'groq') {
          groqKey = encryptionService.decrypt(row.encrypted_key);
        } else if (row.provider === 'gemini') {
          geminiKey = encryptionService.decrypt(row.encrypted_key);
        }
      } catch (err) {
        logger.error({ err: err.message, provider: row.provider }, 'Failed to decrypt API key');
      }
    }

    // 2. Format prompt
    let prompt = config.prompt || '';
    for (const [key, val] of Object.entries(inputs)) {
      if (val && typeof val.result === 'string') {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), val.result);
      } else if (val) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), JSON.stringify(val));
      }
    }

    // 3. Try Groq first
    try {
      logger.info({ userId }, 'Calling Groq LLM API');
      if (!groqKey) throw new Error('User has not configured a Groq API key');

      const groq = new Groq({ apiKey: groqKey });
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
      });

      return {
        result: chatCompletion.choices[0]?.message?.content || '',
        provider: 'groq'
      };
    } catch (groqError) {
      logger.warn({ err: groqError.message, userId }, 'Groq API call failed. Falling back to Gemini.');

      // 4. Fallback to Gemini
      try {
        if (!geminiKey) throw new Error('User has not configured a Gemini API key');
        
        const genAI = new GoogleGenerativeAI(geminiKey);
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
        logger.error({ err: geminiError.message, userId }, 'Gemini fallback also failed');
        throw new Error(`LLM Call failed on both providers. Groq: ${groqError.message}, Gemini: ${geminiError.message}`);
      }
    }
  }
};

module.exports = llmNode;
