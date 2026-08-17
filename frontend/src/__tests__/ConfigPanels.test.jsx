import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfigPanels from '../components/ConfigPanels';

describe('ConfigPanels Component', () => {
  const mockOnClose = vi.fn();

  it('renders prompt textarea for llm_call node type', () => {
    const node = {
      id: 'n1',
      data: { type: 'llm_call', config: { prompt: 'Hello world' } }
    };
    const mockOnChange = vi.fn();

    render(<ConfigPanels node={node} onChange={mockOnChange} onClose={mockOnClose} />);

    expect(screen.getByText('llm call Config')).toBeInTheDocument();
    expect(screen.getByText(/Prompt Template/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Enter prompt/i);
    expect(textarea.value).toBe('Hello world');
  });

  it('renders expression input for condition node type', () => {
    const node = {
      id: 'n2',
      data: { type: 'condition', config: { expression: "inputs['n1'].result === 'yes'" } }
    };
    const mockOnChange = vi.fn();

    render(<ConfigPanels node={node} onChange={mockOnChange} onClose={mockOnClose} />);

    expect(screen.getByText('condition Config')).toBeInTheDocument();
    expect(screen.getByText(/Javascript Expression/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/inputs\['n1'\]/i);
    expect(input.value).toBe("inputs['n1'].result === 'yes'");
  });

  it('renders tool select and JSON params for tool_call node type', () => {
    const node = {
      id: 'n3',
      data: { type: 'tool_call', config: { tool: 'web_search', params: { query: 'AI trends' } } }
    };
    const mockOnChange = vi.fn();

    render(<ConfigPanels node={node} onChange={mockOnChange} onClose={mockOnClose} />);

    expect(screen.getByText('tool call Config')).toBeInTheDocument();
    expect(screen.getByText(/Tool Selection/i)).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    expect(select.value).toBe('web_search');
  });

  it('calls onChange when config values change', () => {
    const node = {
      id: 'n1',
      data: { type: 'llm_call', config: {} }
    };
    const mockOnChange = vi.fn();

    render(<ConfigPanels node={node} onChange={mockOnChange} onClose={mockOnClose} />);

    const textarea = screen.getByPlaceholderText(/Enter prompt/i);
    fireEvent.change(textarea, { target: { value: 'New prompt text' } });

    expect(mockOnChange).toHaveBeenCalledWith({ prompt: 'New prompt text' });
  });

  it('shows unknown node type message for unsupported types', () => {
    const node = {
      id: 'n4',
      data: { type: 'unknown_type', config: {} }
    };
    const mockOnChange = vi.fn();

    render(<ConfigPanels node={node} onChange={mockOnChange} onClose={mockOnClose} />);

    expect(screen.getByText('Unknown node type.')).toBeInTheDocument();
  });

  it('shows node ID in the footer', () => {
    const node = {
      id: 'test-node-42',
      data: { type: 'llm_call', config: {} }
    };
    const mockOnChange = vi.fn();

    render(<ConfigPanels node={node} onChange={mockOnChange} onClose={mockOnClose} />);

    expect(screen.getByText(/test-node-42/)).toBeInTheDocument();
  });
});
