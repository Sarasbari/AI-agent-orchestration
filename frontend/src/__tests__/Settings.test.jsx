import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Settings from '../pages/Settings';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Settings Component', () => {
  it('renders API key form with provider dropdown and input', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] });

    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText(/Provider API Keys/i)).toBeInTheDocument();

    // Provider dropdown
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // API key input
    const input = screen.getByPlaceholderText(/Enter API Key/i);
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');

    // Save button
    expect(screen.getByRole('button', { name: /Save Key/i })).toBeInTheDocument();
  });

  it('shows empty state when no keys exist', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [] });

    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No API keys configured yet/i)).toBeInTheDocument();
    });
  });

  it('renders keys table when keys exist', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: [
        { id: 'k1', provider: 'groq', masked_key: 'gsk_****abcd', created_at: new Date().toISOString() },
        { id: 'k2', provider: 'gemini', masked_key: 'AI****wxyz', created_at: new Date().toISOString() }
      ]
    });

    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('groq')).toBeInTheDocument();
      expect(screen.getByText('gemini')).toBeInTheDocument();
      expect(screen.getByText('gsk_****abcd')).toBeInTheDocument();
      expect(screen.getByText('AI****wxyz')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    apiClient.get.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <BrowserRouter>
        <Settings />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading keys...')).toBeInTheDocument();
  });
});
