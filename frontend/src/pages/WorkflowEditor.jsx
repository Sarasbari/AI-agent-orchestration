import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import apiClient from '../api/client';
import { Play, Save, History, Plus } from 'lucide-react';
import ConfigPanels from '../components/ConfigPanels';
import { useAuth } from '@clerk/clerk-react';

export default function WorkflowEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflow, setWorkflow] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Live Status
  const [activeRunId, setActiveRunId] = useState(null);
  const [nodeStatuses, setNodeStatuses] = useState({}); // { nodeId: 'running'|'completed'|'failed' }
  const sseRef = useRef(null);
  const { getToken } = useAuth();

  useEffect(() => {
    fetchWorkflow();
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, [id]);

  useEffect(() => {
    // If "?run=true" is in URL, trigger run immediately after load
    if (workflow && searchParams.get('run') === 'true') {
      triggerRun();
      // remove from url to avoid looping
      navigate(`/workflows/${id}`, { replace: true });
    }
  }, [workflow, searchParams]);

  const fetchWorkflow = async () => {
    try {
      const res = await apiClient.get(`/workflows/${id}`);
      const wf = res.data;
      if (wf) {
        setWorkflow(wf);
        if (wf.dag_definition) {
          // Restore React Flow position data alongside backend node data
          const rfNodes = (wf.dag_definition.nodes || []).map((n, i) => ({
            id: n.id,
            type: 'default',
            position: n.position || { x: 100 + i * 200, y: 150 },
            data: { label: `${n.type} node`, type: n.type, config: n.config || {} }
          }));
          const rfEdges = (wf.dag_definition.edges || []).map(e => ({
            id: `${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            label: e.label,
            markerEnd: { type: MarkerType.ArrowClosed }
          }));
          setNodes(rfNodes);
          setEdges(rfEdges);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const addNode = (type) => {
    const newNode = {
      id: `n${Date.now()}`,
      type: 'default', // React flow type
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: `${type} node`, type: type, config: {} }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const saveWorkflow = async () => {
    try {
      // transform react-flow nodes to backend expected format
      const backendNodes = nodes.map(n => ({
        id: n.id,
        type: n.data.type,
        config: n.data.config || {},
        position: n.position
      }));
      
      const backendEdges = edges.map(e => ({
        source: e.source,
        target: e.target,
        label: e.sourceHandle || e.label // use handle or label for true/false branches
      }));

      await apiClient.put(`/workflows/${id}`, {
        name: workflow.name,
        dag_definition: { nodes: backendNodes, edges: backendEdges }
      });
      alert('Saved successfully');
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  const triggerRun = async () => {
    try {
      const res = await apiClient.post(`/workflows/${id}/run`);
      setActiveRunId(res.data.id);
      setNodeStatuses({});
      connectSSE(res.data.id);
    } catch (e) {
      console.error(e);
      alert('Failed to trigger run');
    }
  };

  const connectSSE = async (runId) => {
    if (sseRef.current) sseRef.current.close();
    
    const abortController = new AbortController();
    const token = await getToken();
    
    fetchEventSource(`http://localhost:3000/api/runs/${runId}/stream`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal: abortController.signal,
      onmessage(event) {
        try {
          const { run, nodes: execNodes } = JSON.parse(event.data);
          const newStatuses = {};
          execNodes.forEach(n => {
            newStatuses[n.node_id] = n.status;
          });
          setNodeStatuses(newStatuses);
          
          if (run.status !== 'running') {
            abortController.abort();
          }
        } catch (e) {
          console.error('SSE parse error:', e);
        }
      },
      onerror(err) {
        console.error('SSE connection error:', err);
        abortController.abort();
      },
    });
    
    sseRef.current = { close: () => abortController.abort() };
  };

  // Color nodes based on status
  const styledNodes = nodes.map(n => {
    const status = nodeStatuses[n.id];
    let bgColor = 'white';
    let borderColor = '#222';
    
    if (status === 'pending') { bgColor = '#fef08a'; borderColor = '#ca8a04'; } // yellow
    else if (status === 'running') { bgColor = '#bfdbfe'; borderColor = '#2563eb'; } // blue
    else if (status === 'completed') { bgColor = '#bbf7d0'; borderColor = '#16a34a'; } // green
    else if (status === 'failed') { bgColor = '#fecaca'; borderColor = '#dc2626'; } // red

    return {
      ...n,
      style: { ...n.style, backgroundColor: bgColor, borderColor, borderWidth: 2 }
    };
  });

  const updateNodeConfig = (nodeId, newConfig) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, config: newConfig } };
      }
      return n;
    }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{workflow?.name || 'Loading...'}</h2>
          {activeRunId && <span className="text-sm text-blue-600 flex items-center mt-1"><div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse mr-2"></div> Live Run: {activeRunId}</span>}
        </div>
        <div className="flex space-x-3">
          <button onClick={() => navigate(`/workflows/${id}/history`)} className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 flex items-center">
            <History size={16} className="mr-2" /> History
          </button>
          <button onClick={saveWorkflow} className="px-3 py-2 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 flex items-center">
            <Save size={16} className="mr-2" /> Save
          </button>
          <button onClick={triggerRun} className="px-3 py-2 border border-transparent rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex items-center">
            <Play size={16} className="mr-2" /> Run
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-3">
          <h3 className="font-medium text-gray-900 mb-2">Node Palette</h3>
          <button onClick={() => addNode('llm_call')} className="p-3 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:border-blue-500 flex items-center"><Plus size={14} className="mr-2"/> LLM Call</button>
          <button onClick={() => addNode('tool_call')} className="p-3 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:border-blue-500 flex items-center"><Plus size={14} className="mr-2"/> Tool Call</button>
          <button onClick={() => addNode('condition')} className="p-3 bg-white border border-gray-300 rounded-md shadow-sm text-left hover:border-blue-500 flex items-center"><Plus size={14} className="mr-2"/> Condition</button>
        </div>

        <div className="flex-1 relative">
          <ReactFlow
            nodes={styledNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {selectedNode && (
          <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto shadow-xl z-10">
            <ConfigPanels 
              node={selectedNode} 
              onChange={(config) => updateNodeConfig(selectedNode.id, config)} 
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
