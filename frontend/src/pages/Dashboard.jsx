import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Play, Clock, Edit } from 'lucide-react';
import apiClient from '../api/client';

export default function Dashboard() {
  const [workflows, setWorkflows] = String(null) ? [] : []; // initialized to [] below
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await apiClient.get('/workflows');
      setList(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createNew = async () => {
    try {
      const res = await apiClient.post('/workflows', {
        name: 'New Workflow ' + new Date().toLocaleTimeString(),
        dag_definition: { nodes: [], edges: [] }
      });
      navigate(`/workflows/${res.data.id}`);
    } catch (e) {
      console.error(e);
      alert('Failed to create workflow');
    }
  };

  if (loading) return <div className="p-8">Loading workflows...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Your Workflows</h1>
        <button 
          onClick={createNew}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} className="mr-2" />
          Create New
        </button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
          <p className="text-gray-500 mb-6">Create your first workflow to start orchestrating AI agents.</p>
          <button 
            onClick={createNew}
            className="inline-flex items-center bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 font-medium"
          >
            <Plus size={18} className="mr-2" />
            Get Started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map(wf => (
            <div key={wf.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2 truncate" title={wf.name}>{wf.name}</h3>
                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <Clock size={14} className="mr-1" />
                  Updated {new Date(wf.updated_at).toLocaleDateString()}
                </div>
                
                <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                  <Link 
                    to={`/workflows/${wf.id}`} 
                    className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Edit size={16} className="mr-1" /> Edit
                  </Link>
                  <button 
                    onClick={() => navigate(`/workflows/${wf.id}?run=true`)}
                    className="flex items-center text-sm font-medium text-green-600 hover:text-green-800"
                  >
                    <Play size={16} className="mr-1" /> Run
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
