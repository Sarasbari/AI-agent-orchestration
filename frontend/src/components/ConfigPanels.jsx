import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function ConfigPanels({ node, onChange, onClose }) {
  const [config, setConfig] = useState(node.data.config || {});

  // Sync state if a different node is clicked
  useEffect(() => {
    setConfig(node.data.config || {});
  }, [node.id, node.data.config]);

  const handleChange = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onChange(newConfig);
  };

  const renderPanel = () => {
    switch (node.data.type) {
      case 'llm_call':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Prompt Template</label>
              <textarea
                rows={6}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                value={config.prompt || ''}
                onChange={e => handleChange('prompt', e.target.value)}
                placeholder="Enter prompt e.g. Summarize this: {{inputs.n1.result}}"
              />
            </div>
          </div>
        );
      
      case 'condition':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Javascript Expression</label>
              <p className="text-xs text-gray-500 mb-1">Evaluates to boolean. Use `inputs`.</p>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border font-mono"
                value={config.expression || ''}
                onChange={e => handleChange('expression', e.target.value)}
                placeholder="inputs['n1'].result === 'yes'"
              />
            </div>
          </div>
        );

      case 'tool_call':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tool Selection</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                value={config.tool || ''}
                onChange={e => handleChange('tool', e.target.value)}
              >
                <option value="">Select a tool...</option>
                <option value="web_search">Web Search</option>
                <option value="db_query">DB Query</option>
                <option value="send_email">Send Email</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Parameters (JSON)</label>
              <textarea
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border font-mono"
                value={config.params ? JSON.stringify(config.params, null, 2) : '{}'}
                onChange={e => {
                  try {
                    handleChange('params', JSON.parse(e.target.value));
                  } catch (err) {
                    // let them type invalid json temporarily, in a real app use a better editor
                  }
                }}
                placeholder='{"query": "AI trends"}'
              />
            </div>
          </div>
        );
      
      default:
        return <div className="text-gray-500 text-sm">Unknown node type.</div>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-200">
        <h3 className="font-bold text-gray-900 capitalize">{node.data.type.replace('_', ' ')} Config</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>
      
      <div className="flex-1">
        {renderPanel()}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400">
        Node ID: {node.id}
      </div>
    </div>
  );
}
