import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { ToastProvider } from '../../../components/Toast';

/**
 * Precedent probe: confirm ToastProvider-style global mount semantics.
 *
 * The Support FAB (and any future globally-mounted affordance) depends on the
 * invariant that a component placed as a direct child of <ToastProvider> at
 * the App shell level mounts EXACTLY ONCE and survives view-state transitions
 * (e.g. App.tsx's `currentView` token toggling between "dashboard", "workflow",
 * etc.) without remounting.
 *
 * If this invariant ever breaks, the FAB would lose its popover state on every
 * navigation — so we lock it down with this test.
 */
describe('App shell mount precedent (ToastProvider children)', () => {
  it('renders a child of <ToastProvider> exactly once and does NOT remount across view-state changes', () => {
    const mountSpy = vi.fn();

    // Stand-in marker for the future <SupportFab>. Increments the spy on mount
    // (and only on mount — empty deps), so we can detect any remount.
    const Marker: React.FC = () => {
      React.useEffect(() => {
        mountSpy();
      }, []);
      return <div data-testid="global-marker">marker</div>;
    };

    // Minimal harness that mirrors App.tsx's shape: an outer state container
    // ("currentView" stand-in) wrapping <ToastProvider> with a sibling-child
    // marker at the shell level. The route-ish sibling re-renders on view
    // changes; the marker must not.
    const TestHarness: React.FC = () => {
      const [view, setView] = useState<'dashboard' | 'workflow' | 'people'>(
        'dashboard',
      );

      return (
        <div>
          <button
            data-testid="to-workflow"
            onClick={() => setView('workflow')}
          >
            workflow
          </button>
          <button data-testid="to-people" onClick={() => setView('people')}>
            people
          </button>
          <ToastProvider>
            {/* Route-ish child whose identity changes per view — would
                normally remount on navigation. */}
            <div data-testid={`route-${view}`} key={view}>
              route: {view}
            </div>
            {/* The global affordance slot — must survive view changes. */}
            <Marker />
          </ToastProvider>
        </div>
      );
    };

    const { getByTestId, queryAllByTestId } = render(<TestHarness />);

    // Initial mount: marker rendered exactly once.
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(queryAllByTestId('global-marker')).toHaveLength(1);
    const initialMarker = getByTestId('global-marker');

    // Capture the initial DOM node so we can prove it's the *same* instance
    // (not a remount that happens to produce an identical-looking node).
    // First view-state transition: dashboard → workflow.
    fireEvent.click(getByTestId('to-workflow'));

    // The sibling route node DID change (proves the parent re-rendered and
    // the view-state token meaningfully toggled).
    expect(getByTestId('route-workflow')).toBeInTheDocument();

    // The Marker must NOT have remounted.
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(getByTestId('global-marker')).toBe(initialMarker);

    // Second view-state transition: workflow → people. Same invariant.
    fireEvent.click(getByTestId('to-people'));
    expect(getByTestId('route-people')).toBeInTheDocument();
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(getByTestId('global-marker')).toBe(initialMarker);
  });
});
