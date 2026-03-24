import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImpersonationPicker from '../../../components/ImpersonationPicker';

vi.mock('../../../services/teamService', () => ({
  getAllProfiles: vi.fn(),
}));

import { getAllProfiles } from '../../../services/teamService';

const mockGetAllProfiles = vi.mocked(getAllProfiles);

const mockProfiles = [
  { id: '1', name: 'Admin User', role: 'Admin', email: 'admin@test.com', avatar: null },
  { id: '2', name: 'Manager User', role: 'Manager', email: 'mgr@test.com', avatar: null },
  { id: '3', name: 'New Hire User', role: 'New Hire', email: 'nh@test.com', avatar: null },
];

describe('ImpersonationPicker', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllProfiles.mockResolvedValue(mockProfiles as any);
  });

  it('should render "View as..." button when isAdmin is true', () => {
    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={false} />);
    expect(screen.getByText('View as...')).toBeInTheDocument();
  });

  it('should NOT render when isAdmin is false', () => {
    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={false} isImpersonating={false} />);
    expect(screen.queryByText('View as...')).not.toBeInTheDocument();
  });

  it('should NOT render when isImpersonating is true', () => {
    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={true} />);
    expect(screen.queryByText('View as...')).not.toBeInTheDocument();
  });

  it('should open dropdown with profile list on click', async () => {
    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={false} />);

    fireEvent.click(screen.getByText('View as...'));

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Manager User')).toBeInTheDocument();
      expect(screen.getByText('New Hire User')).toBeInTheDocument();
    });
  });

  it('should filter profiles by search input', async () => {
    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={false} />);

    fireEvent.click(screen.getByText('View as...'));

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Search users...'), { target: { value: 'Manager' } });

    expect(screen.getByText('Manager User')).toBeInTheDocument();
    expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
    expect(screen.queryByText('New Hire User')).not.toBeInTheDocument();
  });

  it('should call onSelectUser when a profile is clicked', async () => {
    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={false} />);

    fireEvent.click(screen.getByText('View as...'));

    await waitFor(() => {
      expect(screen.getByText('Manager User')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Manager User'));
    expect(mockOnSelect).toHaveBeenCalledWith(mockProfiles[1]);
  });

  it('should show loading state while fetching profiles', async () => {
    mockGetAllProfiles.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={false} />);
    fireEvent.click(screen.getByText('View as...'));

    expect(screen.getByText('Loading profiles...')).toBeInTheDocument();
  });

  it('should show error with retry on fetch failure', async () => {
    mockGetAllProfiles.mockRejectedValueOnce(new Error('Network error'));

    render(<ImpersonationPicker onSelectUser={mockOnSelect} isAdmin={true} isImpersonating={false} />);
    fireEvent.click(screen.getByText('View as...'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load profiles')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
