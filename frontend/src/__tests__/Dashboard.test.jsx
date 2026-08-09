import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from '../pages/Dashboard';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('Dashboard Component', () => {
  it('shows loading state initially', () => {
    apiClient.get.mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('renders workflows list when data is loaded', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: [
        { id: '1', name: 'Test Workflow 1', updated_at: new Date().toISOString() }
      ]
    });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
    });
  });

  it('shows empty state when no workflows', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] });

    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No workflows yet')).toBeInTheDocument();
    });
  });
});
