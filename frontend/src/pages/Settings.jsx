import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { KeyRound, Trash2 } from 'lucide-react';

export default function Settings() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [provider, setProvider] = useState('groq');
  const [keyValue, setKeyValue] = useState('');

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await apiClient.get('/keys');
      setKeys(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/keys', { provider, api_key: keyValue });
      setKeyValue('');
      fetchKeys();
    } catch (e) {
      alert('Failed to save key');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this key?')) return;
    try {
      await apiClient.delete(`/keys/${id}`);
      fetchKeys();
    } catch (e) {
      alert('Failed to delete key');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your API keys and provider integrations.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <KeyRound size={18} className="mr-2 text-gray-500" />
            Provider API Keys
          </h3>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleAdd} className="flex gap-4 mb-8">
            <select 
              value={provider} 
              onChange={e => setProvider(e.target.value)}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            >
              <option value="groq">Groq</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            
            <input 
              type="password" 
              required
              placeholder="Enter API Key"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            />
            
            <button 
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Save Key
            </button>
          </form>

          {loading ? (
            <div className="text-sm text-gray-500">Loading keys...</div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-gray-500 italic">No API keys configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Masked Key</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {keys.map(key => (
                    <tr key={key.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                        {key.provider}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {key.masked_key}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handleDelete(key.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
