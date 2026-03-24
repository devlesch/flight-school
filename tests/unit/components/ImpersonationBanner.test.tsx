import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImpersonationBanner from '../../../components/ImpersonationBanner';
import { UserRole } from '../../../types';

describe('ImpersonationBanner', () => {
  const mockOnExit = vi.fn();
  const mockUser = {
    id: '2',
    name: 'Jane Smith',
    role: UserRole.MANAGER,
    avatar: 'https://example.com/avatar.jpg',
    title: 'Regional Manager',
    email: 'jane@industrious.com',
  };

  it('should render the impersonated user name and role', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Manager/)).toBeInTheDocument();
  });

  it('should display "UI preview only" disclaimer text', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    expect(screen.getByText(/UI preview only/i)).toBeInTheDocument();
  });

  it('should call onExit when Exit button is clicked', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    fireEvent.click(screen.getByRole('button', { name: /exit/i }));

    expect(mockOnExit).toHaveBeenCalledTimes(1);
  });

  it('should use brand colors (golden yellow bg, dark teal text)', () => {
    render(<ImpersonationBanner impersonatedUser={mockUser} onExit={mockOnExit} />);

    const banner = screen.getByTestId('impersonation-banner');
    expect(banner).toBeInTheDocument();
    // Verify the banner has the golden yellow background class
    expect(banner.className).toContain('bg-[#FDD344]');
    expect(banner.className).toContain('text-[#013E3F]');
  });

  it('should render with New Hire role correctly', () => {
    const newHireUser = {
      ...mockUser,
      name: 'Bob Johnson',
      role: UserRole.NEW_HIRE,
    };
    render(<ImpersonationBanner impersonatedUser={newHireUser} onExit={mockOnExit} />);

    expect(screen.getByText(/Bob Johnson/)).toBeInTheDocument();
    expect(screen.getByText(/New Hire/)).toBeInTheDocument();
  });
});
