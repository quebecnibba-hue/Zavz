/* ZAVZ - File selection regression checks by opZywl | https://lucas-lima.xyz */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PayloadConfiguration, PayloadStatus } from '../types/tauri';
import { VersionModal } from './VersionModal';

const backend = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: backend.invoke }));
vi.mock('../utils/runtime', () => ({ isTauriRuntime: () => true }));
const path = 'D:\\My downloads\\renamed client espaço ç.jar';
const configuration: PayloadConfiguration = {
  selected: ['visuals'],
  allowMultiple: false,
  visualsJar: '',
  fdpclientJar: '',
  fdpLunarJar: '',
};
function statuses(current: PayloadConfiguration): PayloadStatus[] {
  return [
    { id: 'visuals', path: current.visualsJar },
    { id: 'fdpclient', path: current.fdpclientJar },
    { id: 'fdplunar', path: current.fdpLunarJar },
  ].map((item) => ({
    ...item,
    state: item.id === 'fdplunar' && item.path ? 'ready' : 'missing',
    message: item.path ? '' : 'Choose a JAR from any folder.',
    sizeBytes: 123456,
    modifiedMs: 0,
  })) as PayloadStatus[];
}
function props(current = configuration) {
  return {
    isOpen: true,
    profile: 'Player',
    configuration: current,
    onClose: vi.fn(),
    onSave: vi.fn<(config: PayloadConfiguration) => Promise<void>>().mockResolvedValue(undefined),
  };
}
const saveButton = () =>
  screen.getByRole('button', { name: 'Save selection' }) as HTMLButtonElement;
const selected = () =>
  screen.getByRole('radio', { name: /FDPClient Inject/ }).getAttribute('aria-checked');
beforeEach(() => {
  backend.invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    if (command === 'pick_jar_file') return Promise.resolve(path);
    if (command === 'identify_jar') return Promise.resolve('fdplunar');
    if (command === 'inspect_payloads')
      return Promise.resolve(statuses(args?.configuration as PayloadConfiguration));
    return Promise.reject(new Error(`Unexpected command: ${command}`));
  });
});
afterEach(cleanup);

it('keeps a cleared path unset and blocks saving until a file is chosen', async () => {
  render(
    <VersionModal {...props({ ...configuration, selected: ['fdplunar'], fdpLunarJar: path })} />
  );
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  fireEvent.change(screen.getByLabelText('FDPClient Inject JAR location'), {
    target: { value: '' },
  });
  await waitFor(() => expect(saveButton().disabled).toBe(true));
  expect(screen.getByLabelText('FDPClient Inject JAR location').getAttribute('value')).toBe('');
});

it('selects FDPClient Inject by content even when the Julia picker was used', async () => {
  const options = props();
  render(<VersionModal {...options} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose the Julia JAR' }));
  await waitFor(() => expect(selected()).toBe('true'));
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  fireEvent.click(saveButton());
  await waitFor(() => expect(options.onSave).toHaveBeenCalledOnce());
  expect(options.onSave.mock.calls[0][0]).toMatchObject({
    selected: ['fdplunar'],
    fdpLunarJar: path,
  });
});

it('ignores older inspection and settings responses after choosing a JAR', async () => {
  let completeOld: (result: PayloadStatus[]) => void = () => undefined;
  const oldInspection = new Promise<PayloadStatus[]>((resolve) => {
    completeOld = resolve;
  });
  let inspected = false;
  const normal = backend.invoke.getMockImplementation();
  backend.invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    if (command === 'inspect_payloads' && !inspected) {
      inspected = true;
      return oldInspection;
    }
    return normal?.(command, args);
  });
  const options = props();
  const view = render(<VersionModal {...options} />);
  await waitFor(() => expect(inspected).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Choose the FDPClient Inject JAR' }));
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  view.rerender(<VersionModal {...options} configuration={{ ...configuration }} />);
  await act(async () => completeOld(statuses(configuration)));
  expect(screen.getByLabelText('FDPClient Inject JAR location').getAttribute('value')).toBe(path);
  expect(selected()).toBe('true');
});

it('preserves a manually entered path after saving and reopening', async () => {
  const options = props();
  const view = render(<VersionModal {...options} />);
  fireEvent.change(screen.getByLabelText('FDPClient Inject JAR location'), {
    target: { value: path },
  });
  await waitFor(() => expect(saveButton().disabled).toBe(false));
  fireEvent.click(saveButton());
  await waitFor(() => expect(options.onSave).toHaveBeenCalledOnce());
  const saved = JSON.parse(JSON.stringify(options.onSave.mock.calls[0][0])) as PayloadConfiguration;
  view.unmount();
  render(<VersionModal {...props(saved)} />);
  expect(screen.getByLabelText('FDPClient Inject JAR location').getAttribute('value')).toBe(path);
  expect(selected()).toBe('true');
});
