import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileCog,
  Gauge,
  Loader2,
  Play,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { PRODUCT } from '../../data/product';
import type { FdpWrapper } from '../../types/tauri';
import { Button } from '../ui/Button';

export type LaunchState = 'idle' | 'working' | 'success' | 'error';
export type CompactAssetState = 'idle' | 'preparing' | 'ready' | 'error';

interface LaunchCardProps {
  selectedProjects: string;
  version: string;
  client: FdpWrapper;
  launchState: LaunchState;
  assetState: CompactAssetState;
  statusMessage: string;
  started: boolean;
  onLaunch: () => void;
  onSelectClient: () => void;
  onPrepareAssets: () => void;
  onConfigureJar: () => void;
  onCustomize: () => void;
}

const CLIENT_LABELS: Record<FdpWrapper, string> = {
  auto: 'Auto detect',
  lunar: 'Lunar Client',
  badlion: 'Badlion Client',
  cmclient: 'CMCLIENT',
  cheatbreaker: 'CheatBreaker',
  vanilla: 'Vanilla',
  forge: 'Forge',
};

const CLIENT_ICONS: Record<FdpWrapper, string> = {
  auto: '/img/icon/social/icon-version-mc.png',
  lunar: '/img/icon/social/lunar-client_logo.png',
  badlion: '/img/icon/social/badlion-logo.png',
  cmclient: '/img/icon/social/cmclient-logo.png',
  cheatbreaker: '/img/icon/social/cheatbreaker.webp',
  vanilla: '/img/icon/social/icon-version-mc.png',
  forge: '/img/icon/social/forge_logo.png',
};

const SHOW_INTERFACE_TOOL = false;

const RELEASE_CHANGELOG = [
  'Added CheatBreaker, BadlionClient, CMClient inject',
  'Added Lunar Client/Forge',
  'Added Vanilla',
] as const;

export function LaunchCard({
  selectedProjects,
  version,
  client,
  launchState,
  assetState,
  statusMessage,
  started,
  onLaunch,
  onSelectClient,
  onPrepareAssets,
  onConfigureJar,
  onCustomize,
}: LaunchCardProps) {
  const isBusy = launchState === 'working';
  const statusIcon = isBusy ? (
    <Loader2 size={14} className="ds-spin" />
  ) : launchState === 'success' || assetState === 'ready' ? (
    <CheckCircle2 size={14} />
  ) : (
    <ShieldCheck size={14} />
  );
  const showStatus = Boolean(statusMessage.trim());

  return (
    <aside
      id="launch"
      className="ds-release-panel"
      aria-label="Injector release and launch controls"
    >
      <div className="ds-release-banner">
        <time>{PRODUCT.releaseDate}</time>
        <h1>ZAVZ {version}</h1>
      </div>

      <div className="ds-release-copy">
        <p>{PRODUCT.releaseSummary}</p>
        <div className="ds-changelog-title">
          <span>Changelog</span>
          <small>Scroll to read</small>
        </div>
        <div
          className="ds-changelog-scroll"
          role="region"
          aria-label="Release changelog"
          tabIndex={0}
        >
          <ul>
            {RELEASE_CHANGELOG.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ds-release-specs" aria-label="Selected versions">
        <div className="ds-release-spec is-static" aria-label={`Injector ${version}`}>
          <span>Injector</span>
          <strong>{version}</strong>
          <small>{PRODUCT.channel}</small>
        </div>
        <button type="button" onClick={onConfigureJar}>
          <span>Minecraft</span>
          <strong>{PRODUCT.minecraftVersion}</strong>
          <small>{selectedProjects || 'Choose project'}</small>
        </button>
      </div>

      <button
        type="button"
        className="ds-client-selector"
        data-client={client}
        onClick={onSelectClient}
        aria-label={`Select client. Current profile: ${CLIENT_LABELS[client]}`}
      >
        <span className="ds-selected-client-logo" aria-hidden="true">
          <img src={CLIENT_ICONS[client]} alt="" />
        </span>
        <span>
          <small>Select client</small>
          <strong>{CLIENT_LABELS[client]}</strong>
        </span>
        <ChevronRight aria-hidden="true" size={16} />
      </button>

      <div className="ds-release-tools" aria-label="Release tools">
        <Button
          variant="ghost"
          size="sm"
          loading={assetState === 'preparing'}
          icon={<Download size={14} />}
          onClick={onPrepareAssets}
        >
          {assetState === 'ready' ? 'Verify files' : 'Check files'}
        </Button>
        <Button variant="ghost" size="sm" icon={<FileCog size={14} />} onClick={onConfigureJar}>
          JAR
        </Button>
        {SHOW_INTERFACE_TOOL && (
          <Button variant="ghost" size="sm" icon={<Gauge size={14} />} onClick={onCustomize}>
            Interface
          </Button>
        )}
      </div>

      {showStatus && (
        <div className={`ds-release-status is-${launchState}`} role="status" aria-live="polite">
          {statusIcon}
          <span>{statusMessage}</span>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        loading={isBusy}
        className={started ? 'is-started' : undefined}
        icon={
          started ? (
            <Square aria-hidden="true" size={14} fill="currentColor" />
          ) : (
            <Play aria-hidden="true" size={16} fill="currentColor" />
          )
        }
        onClick={onLaunch}
      >
        Start
      </Button>
    </aside>
  );
}
