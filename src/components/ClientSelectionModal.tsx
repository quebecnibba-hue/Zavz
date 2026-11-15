import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { FdpWrapper } from '../types/tauri';
import { Button } from './ui/Button';

interface ClientSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selected: FdpWrapper;
  onSelect: (wrapper: FdpWrapper) => void;
}

const clients: Array<{
  id: FdpWrapper;
  name: string;
  logo: string;
  statusText: string;
}> = [
  {
    id: 'auto',
    name: 'Auto detect',
    logo: '/img/icon/social/fdp-logo.png',
    statusText: 'Find the active supported Minecraft client automatically.',
  },
  {
    id: 'cmclient',
    name: 'CMCLIENT',
    logo: '/img/icon/social/cmclient-logo.png',
    statusText: 'Minecraft 1.8.9 via cmpack or cmlauncher.',
  },
  {
    id: 'badlion',
    name: 'Badlion Client',
    logo: '/img/icon/social/badlion-logo.png',
    statusText: 'Minecraft 1.8.9 running with the Badlion JDK.',
  },
  {
    id: 'lunar',
    name: 'Lunar Client',
    logo: '/img/icon/social/lunar-client_logo.png',
    statusText: 'The running Minecraft session, not the Lunar home screen.',
  },
  {
    id: 'cheatbreaker',
    name: 'CheatBreaker',
    logo: '/img/icon/social/cheatbreaker.webp',
    statusText: 'Detects the CheatBreaker process; the Minecraft version is not verified.',
  },
  {
    id: 'vanilla',
    name: 'Vanilla',
    logo: '/img/icon/social/icon-version-mc.png',
    statusText: 'Official Minecraft 1.8.9 game process.',
  },
  {
    id: 'forge',
    name: 'Minecraft Forge',
    logo: '/img/icon/social/forge_logo.png',
    statusText: 'Minecraft Forge 1.8.9 using the MCP path.',
  },
];

export function ClientSelectionModal({
  isOpen,
  onClose,
  selected,
  onSelect,
}: ClientSelectionModalProps) {
  const [pending, setPending] = useState<FdpWrapper>(selected);

  useEffect(() => {
    if (!isOpen) return;
    setPending(selected);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selected]);

  if (!isOpen) return null;

  return (
    <div
      className="ds-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ds-modal ds-client-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-title"
      >
        <header className="ds-modal-header">
          <div>
            <p className="ds-overline">Target client</p>
            <h2 id="client-title">Select detection profile</h2>
          </div>
          <button className="ds-icon-button" onClick={onClose} aria-label="Close client selection">
            <X size={16} />
          </button>
        </header>

        <div className="ds-client-list" role="radiogroup" aria-label="Supported clients">
          {clients.map((client) => {
            const isActive = client.id === pending;
            return (
              <button
                key={client.id}
                type="button"
                className={`ds-client-option ${isActive ? 'active' : ''}`}
                data-client={client.id}
                role="radio"
                aria-checked={isActive}
                onClick={() => setPending(client.id)}
              >
                <span className="ds-client-logo">
                  <img src={client.logo} alt={`${client.name} logo`} />
                </span>
                <span>
                  <strong>{client.name}</strong>
                  <small>{client.statusText}</small>
                </span>
                <span className="ds-client-check">{isActive && <Check size={13} />}</span>
              </button>
            );
          })}
        </div>

        <footer className="ds-modal-footer">
          <span className="ds-field-help">This preference is saved locally.</span>
          <div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              icon={<Check size={14} />}
              onClick={() => {
                onSelect(pending);
                onClose();
              }}
            >
              Save profile
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
