import React, { useState, useRef, useEffect, useId } from 'react';
import { LifeBuoy, X } from 'lucide-react';
import type { Profile } from '../types/database';
import { useSupportContact } from '../hooks/useSupportContact';
import { buildSlackDeepLink } from '../services/slackService';

interface SupportFabProps {
  currentProfile: Profile;
}

/**
 * SupportFab — Globally mounted floating action button that opens a popover
 * card surfacing the user's direct manager (or fallback support contact).
 *
 * Three-tier source:
 *  - "manager": signed-in user's `manager_id` resolves.
 *  - "fallback": prepends a "Your fallback support contact" label above the
 *    same manager-style card.
 *  - "none": empty-state copy, no Slack/Email CTAs.
 *
 * Accessibility:
 *  - FAB has `aria-label="Open support"`.
 *  - Popover has `role="dialog"` + `aria-labelledby` pointing at the heading.
 *  - Dismisses on Escape + outside click.
 *  - Focus moves into the dialog on open.
 */
const SupportFab: React.FC<SupportFabProps> = ({ currentProfile }) => {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();

  const { contact, source, loading } = useSupportContact(currentProfile);
  const { primary, fallback } = buildSlackDeepLink(contact?.email ?? '');

  // Escape key dismissal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Outside-click dismissal
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (cardRef.current && cardRef.current.contains(target)) return;
      if (fabRef.current && fabRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Focus management — move focus into the dialog on open.
  useEffect(() => {
    if (!open) return;
    // Defer to next tick so refs/portal content is mounted.
    const id = window.setTimeout(() => {
      if (closeBtnRef.current) {
        closeBtnRef.current.focus();
      } else if (cardRef.current) {
        const focusable = cardRef.current.querySelector<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, source, loading]);

  const initials = (name: string | undefined | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]![0] : '';
    return (first + last).toUpperCase() || '?';
  };

  const renderCardBody = () => {
    if (loading) {
      return (
        <div data-testid="support-fab-skeleton" className="animate-pulse">
          <div className="text-sm text-gray-500">Loading…</div>
          <div className="h-3 bg-gray-200 rounded mt-3" />
          <div className="h-3 bg-gray-200 rounded mt-2 w-2/3" />
        </div>
      );
    }

    if (source === 'none' || !contact) {
      return (
        <div>
          <h2 id={headingId} className="text-sm font-medium text-gray-900">
            Support
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            No support contact configured — contact People Ops
          </p>
        </div>
      );
    }

    // manager OR fallback — same card shape
    return (
      <div>
        {source === 'fallback' && (
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            Your fallback support contact
          </p>
        )}
        <div className="flex items-center gap-3">
          {contact.avatar ? (
            <img
              src={contact.avatar}
              alt={contact.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold"
            >
              {initials(contact.name)}
            </div>
          )}
          <div className="min-w-0">
            <h2
              id={headingId}
              className="text-sm font-semibold text-gray-900 truncate"
            >
              {contact.name}
            </h2>
            {contact.title && (
              <p className="text-xs text-gray-600 truncate">{contact.title}</p>
            )}
            <p className="text-xs text-gray-500 truncate">{contact.email}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {primary && (
            <a
              href={primary}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
            >
              Open in Slack
            </a>
          )}
          {fallback && (
            <a
              href={fallback}
              className="block w-full text-center bg-gray-100 text-gray-900 py-2 rounded hover:bg-gray-200"
            >
              Email
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        aria-label="Open support"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-20 z-30 rounded-full bg-blue-600 text-white p-3 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <LifeBuoy aria-hidden="true" className="h-6 w-6" />
      </button>
      {open && (
        <div
          ref={cardRef}
          role="dialog"
          aria-labelledby={headingId}
          aria-modal="false"
          className="fixed bottom-24 right-20 z-50 bg-white rounded-lg shadow-xl p-4 w-80 border border-gray-200"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-gray-400">
              Support
            </span>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="Close support"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1 -m-1 rounded"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {renderCardBody()}
        </div>
      )}
    </>
  );
};

export default SupportFab;
