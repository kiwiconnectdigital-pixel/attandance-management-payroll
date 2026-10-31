import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Shared modal.
 *
 * Styled with its own scoped CSS (instead of Tailwind utility classes) so it
 * always renders as a centred popup with a dark backdrop, whether or not
 * Tailwind is being compiled. It is rendered into document.body so no page
 * layout (overflow / stacking context) can push it to the bottom of the page.
 *
 * Props are unchanged: isOpen, onClose, title, children, size.
 */
const MAX_WIDTH = {
  sm: '400px',
  md: '520px',
  lg: '720px',
  xl: '920px',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const maxWidth = MAX_WIDTH[size] || MAX_WIDTH.md;

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{`
        .ams-modal-root {
          position: fixed;
          inset: 0;
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(17, 19, 24, 0.55);
          backdrop-filter: blur(3px);
          color: #15171C;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .ams-modal-root *,
        .ams-modal-root *::before,
        .ams-modal-root *::after {
          box-sizing: border-box;
        }

        .ams-modal-root input,
        .ams-modal-root select,
        .ams-modal-root textarea,
        .ams-modal-root button {
          font-family: inherit;
        }

        .ams-modal-card {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-height: calc(100vh - 48px);
          overflow: hidden;
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 30px 80px rgba(17, 19, 24, 0.32);
        }

        .ams-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px 24px;
          border-bottom: 1px solid #E7E9ED;
          flex-shrink: 0;
        }

        .ams-modal-title {
          margin: 0;
          color: #15171C;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .ams-modal-close {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          padding: 0;
          border: 1px solid #E7E9ED;
          border-radius: 10px;
          background: #FFFFFF;
          color: #676C76;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .ams-modal-close:hover {
          background: #F6F7F9;
          color: #15171C;
        }

        .ams-modal-close svg {
          width: 17px;
          height: 17px;
        }

        .ams-modal-body {
          flex: 1;
          min-height: 0;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 20px 24px 24px;
        }

        @media (max-width: 640px) {
          .ams-modal-root {
            padding: 10px;
          }

          .ams-modal-card {
            max-height: calc(100vh - 20px);
            border-radius: 16px;
          }

          .ams-modal-header,
          .ams-modal-body {
            padding-left: 16px;
            padding-right: 16px;
          }
        }
      `}</style>

      <div
        className="ams-modal-root"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="ams-modal-card"
          style={{ maxWidth }}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
        >
          <div className="ams-modal-header">
            <h3 className="ams-modal-title">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="ams-modal-close"
              aria-label="Close"
            >
              <XMarkIcon />
            </button>
          </div>
          <div className="ams-modal-body">{children}</div>
        </div>
      </div>
    </>,
    document.body
  );
}