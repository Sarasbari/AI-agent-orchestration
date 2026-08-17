import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, RotateCcw, Loader2 } from 'lucide-react';

export default function RunDetail() {
  const { id: workflowId, runId } = useParams();
  const [run, setRun] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(null); // nodeId being retried

  useEffect(() => {
    fetchRunDetail();
  }, [runId]);

  // Auto-refresh while run is still running
  useEffect(() => {
    if (run && run.status === 'running') {
      const interval = setInterval(fetchRunDetail, 2000);
      return () => clearInterval(interval);
    }
  }, [run?.status]);

  const fetchRunDetail = async () => {
    try {
      const res = await apiClient.get(`/runs/${runId}`);
      setRun(res.data.run);
      setNodes(res.data.nodes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const retryNode = async (nodeId) => {
    setRetrying(nodeId);
    try {
      await apiClient.post(`/runs/${runId}/nodes/${nodeId}/retry`);
      // Refetch to show updated state
      await fetchRunDetail();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error?.message || 'Failed to retry node');
    } finally {
      setRetrying(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} className="mr-1" /> Completed</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle size={12} className="mr-1" /> Failed</span>;
      case 'running':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><RefreshCw size={12} className="mr-1 animate-spin" /> Running</span>;
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock size={12} className="mr-1" /> Pending</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading run details...</div>;
  if (!run) return <div className="p-8 text-red-500">Run not found.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Link to={`/workflows/${workflowId}/history`} className="text-gray-500 hover:text-gray-900 mr-4">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Run Detail</h1>
            <p className="text-sm text-gray-500 font-mono">{runId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(run.status)}
          <button
            onClick={fetchRunDetail}
            className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 flex items-center text-sm"
          >
            <RefreshCw size={14} className="mr-2" /> Refresh
          </button>
        </div>
      </div>

      {/* Run meta */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Status</span>
            <span className="font-medium text-gray-900 capitalize">{run.status}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Started</span>
            <span className="font-medium text-gray-900">{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Completed</span>
            <span className="font-medium text-gray-900">{run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Nodes</span>
            <span className="font-medium text-gray-900">{nodes.length}</span>
          </div>
        </div>
        {run.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            <strong>Error:</strong> {run.error}
          </div>
        )}
      </div>

      {/* Node Executions */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Node Executions</h2>
      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        {nodes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No node executions recorded.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {nodes.map((node) => (
              <li key={node.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{node.node_id}</span>
                      {getStatusBadge(node.status)}
                      {node.retry_count > 0 && (
                        <span className="text-xs text-gray-400">Retries: {node.retry_count}</span>
                      )}
                    </div>

                    {/* Timing info */}
                    <div className="flex gap-4 text-xs text-gray-500 mb-2">
                      {node.started_at && <span>Started: {new Date(node.started_at).toLocaleTimeString()}</span>}
                      {node.completed_at && <span>Completed: {new Date(node.completed_at).toLocaleTimeString()}</span>}
                    </div>

                    {/* Output (truncated) */}
                    {node.output && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">View Output</summary>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-700 overflow-x-auto max-h-40 overflow-y-auto">
                          {typeof node.output === 'string' ? node.output : JSON.stringify(node.output, null, 2)}
                        </pre>
                      </details>
                    )}

                    {/* Error */}
                    {node.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                        {node.error}
                      </div>
                    )}
                  </div>

                  {/* Retry button — only for failed nodes */}
                  {node.status === 'failed' && (
                    <button
                      onClick={() => retryNode(node.node_id)}
                      disabled={retrying === node.node_id}
                      className="ml-4 flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md hover:bg-orange-100 text-sm font-medium disabled:opacity-50"
                    >
                      {retrying === node.node_id ? (
                        <><Loader2 size={14} className="mr-1 animate-spin" /> Retrying...</>
                      ) : (
                        <><RotateCcw size={14} className="mr-1" /> Retry</>
                      )}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
