import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function RunHistory() {
  const { id } = useParams();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
  }, [id]);

  const fetchRuns = async () => {
    try {
      const res = await apiClient.get(`/workflows/${id}/runs`);
      setRuns(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} className="mr-1"/> Completed</span>;
      case 'failed': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle size={12} className="mr-1"/> Failed</span>;
      case 'running': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><RefreshCw size={12} className="mr-1 animate-spin"/> Running</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center">
        <Link to={`/workflows/${id}`} className="text-gray-500 hover:text-gray-900 mr-4">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Run History</h1>
          <p className="text-sm text-gray-500">Workflow: {id}</p>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="p-6 text-center text-gray-500">Loading...</li>
          ) : runs.length === 0 ? (
            <li className="p-6 text-center text-gray-500">No runs found for this workflow.</li>
          ) : (
            runs.map((run) => (
              <li key={run.id}>
                <Link 
                  to={`/workflows/${id}/runs/${run.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-gray-900 truncate flex items-center mb-1">
                        Run: <span className="font-mono ml-2 text-xs text-gray-500">{run.id}</span>
                      </p>
                      <p className="flex items-center text-sm text-gray-500">
                        <Clock size={14} className="mr-1" />
                        Started: {new Date(run.started_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="mb-2">{getStatusBadge(run.status)}</div>
                      {run.error && <p className="text-xs text-red-600 max-w-xs truncate" title={run.error}>{run.error}</p>}
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
