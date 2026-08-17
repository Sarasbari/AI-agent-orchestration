import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import RunDetail from '../pages/RunDetail';
import apiClient from '../api/client';

// Mock useParams to provide route params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'wf-1', runId: 'run-1' })
  };
});

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('RunDetail Component', () => {
  const mockRunData = {
    run: {
      id: 'run-1',
      workflow_id: 'wf-1',
      status: 'failed',
      started_at: '2026-08-16T10:00:00Z',
      completed_at: '2026-08-16T10:01:00Z',
      error: 'Node n2 failed: API timeout'
    },
    nodes: [
      {
        id: 'ne-1',
        run_id: 'run-1',
        node_id: 'n1',
        status: 'completed',
        output: { result: 'Some LLM output' },
        error: null,
        started_at: '2026-08-16T10:00:01Z',
        completed_at: '2026-08-16T10:00:05Z',
        retry_count: 0
      },
      {
        id: 'ne-2',
        run_id: 'run-1',
        node_id: 'n2',
        status: 'failed',
        output: null,
        error: 'API timeout',
        started_at: '2026-08-16T10:00:06Z',
        completed_at: '2026-08-16T10:00:10Z',
        retry_count: 3
      }
    ]
  };

  it('renders node execution list with status badges', async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockRunData });

    render(
      <BrowserRouter>
        <RunDetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Run Detail')).toBeInTheDocument();
      expect(screen.getByText('n1')).toBeInTheDocument();
      expect(screen.getByText('n2')).toBeInTheDocument();
      // 'Completed' appears as both a grid meta label and a status badge
      expect(screen.getAllByText(/Completed/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Failed/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows error message for failed run', async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockRunData });

    render(
      <BrowserRouter>
        <RunDetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Node n2 failed: API timeout/)).toBeInTheDocument();
    });
  });

  it('shows retry button only for failed nodes', async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockRunData });

    render(
      <BrowserRouter>
        <RunDetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should have exactly one Retry button (for the failed node n2)
      const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
      expect(retryButtons).toHaveLength(1);
    });
  });

  it('shows retry count for retried nodes', async () => {
    apiClient.get.mockResolvedValueOnce({ data: mockRunData });

    render(
      <BrowserRouter>
        <RunDetail />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Retries: 3')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    apiClient.get.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <BrowserRouter>
        <RunDetail />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading run details...')).toBeInTheDocument();
  });
});
