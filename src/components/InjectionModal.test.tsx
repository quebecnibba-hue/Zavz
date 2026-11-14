/* ZAVZ - Lunar startup regression checks by opZywl | https://lucas-lima.xyz */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { InjectionModal } from './InjectionModal';

const backend = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: backend.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: backend.listen }));

function props() {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onInject: vi.fn().mockResolvedValue(undefined),
    dllPath: '',
    setDllPath: vi.fn(),
    fdpMode: false,
    setFdpMode: vi.fn(),
    fdpInject: true,
    onStartLunar: vi.fn().mockResolvedValue(undefined),
    onStopLunar: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  backend.listen.mockResolvedValue(vi.fn());
  backend.invoke.mockImplementation((command: string) => {
    if (command === 'pick_dll_file') return Promise.resolve('D:\\My loaders\\custom.dll');
    if (command === 'list_minecraft_clients')
      return Promise.resolve([{ pid: 36648, name: 'javaw.exe', kind: 'lunar', title: 'Lunar' }]);
    return Promise.reject(new Error(`Unexpected command: ${command}`));
  });
});
afterEach(cleanup);

it('keeps optional startup loading available alongside injection into an open game', async () => {
  const options = props();
  render(<InjectionModal {...options} />);
  expect(screen.queryByRole('button', { name: 'Detect' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Inject' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Inject into running Lunar' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Watch next Lunar startup' }));
  await waitFor(() => expect(options.onStartLunar).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Watch next Lunar startup' }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
  );
  expect(options.onInject).not.toHaveBeenCalled();
  expect(options.onClose).not.toHaveBeenCalled();
  expect(screen.queryByText('Injection successful')).toBeNull();
});

it('shows the restart instruction for an existing game and lets the user stop watching', async () => {
  const options = props();
  const message = 'Lunar is already running. Close the game and launch it again; ZAVZ is watching.';
  render(
    <InjectionModal {...options} watcherActive watcherStatus={{ state: 'waiting', message }} />
  );
  expect(screen.getByRole('status').textContent).toContain(message);
  fireEvent.click(screen.getByRole('button', { name: 'Stop watching' }));
  await waitFor(() => expect(options.onStopLunar).toHaveBeenCalledOnce());
  expect(options.onStartLunar).not.toHaveBeenCalled();
  expect(options.onInject).not.toHaveBeenCalled();
});

it('passes a manually selected DLL to startup loading and reports actual readiness', async () => {
  const options = props();
  const view = render(<InjectionModal {...options} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose DLL' }));
  await screen.findByText('DLL: D:\\My loaders\\custom.dll');
  fireEvent.click(screen.getByRole('button', { name: 'Watch next Lunar startup' }));
  await waitFor(() =>
    expect(options.onStartLunar).toHaveBeenCalledWith('D:\\My loaders\\custom.dll')
  );
  view.rerender(
    <InjectionModal
      {...options}
      watcherActive
      watcherStatus={{ state: 'loading', message: 'New Lunar startup detected. Loading...' }}
    />
  );
  expect(screen.getByRole('status').textContent).toContain('Loading FDPClient Inject');
  expect(screen.queryByText('FDPClient Inject loaded')).toBeNull();
  view.rerender(
    <InjectionModal
      {...options}
      watcherActive
      watcherStatus={{ state: 'success', message: 'FDP confirmed startup.' }}
    />
  );
  expect(screen.getByRole('status').textContent).toContain('FDPClient Inject loaded');
});

it('keeps Julia detection and injection into a running client available', async () => {
  const options = props();
  render(<InjectionModal {...options} fdpInject={false} />);
  fireEvent.click(screen.getByRole('button', { name: /Detect/ }));
  await screen.findByText('LunarClient · PID 36648');
  fireEvent.click(screen.getByRole('button', { name: 'Inject' }));
  await waitFor(() => expect(options.onInject).toHaveBeenCalledOnce());
  expect(options.onInject.mock.calls[0].slice(0, 2)).toEqual(['detect', { pids: [36648] }]);
  expect(options.onStartLunar).not.toHaveBeenCalled();
});

it('selects a running Lunar process and excludes Forge from FDPClient Inject targets', async () => {
  backend.invoke.mockResolvedValueOnce([
    { pid: 100, name: 'javaw.exe', kind: 'forge', title: 'Minecraft Forge' },
    { pid: 36648, name: 'javaw.exe', kind: 'lunar', title: 'Lunar 1.8.9' },
  ]);
  const options = props();
  render(<InjectionModal {...options} />);
  fireEvent.click(screen.getByRole('button', { name: 'Inject into running Lunar' }));
  await screen.findByText('LunarClient · PID 36648');
  expect(screen.queryByText('Forge · PID 100')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Inject' }));
  await waitFor(() => expect(options.onInject).toHaveBeenCalledOnce());
  expect(options.onInject.mock.calls[0].slice(0, 2)).toEqual(['detect', { target: '36648' }]);
  expect(options.onStartLunar).not.toHaveBeenCalled();
});

it('uses a manually selected DLL when injecting into an open Lunar game', async () => {
  const options = props();
  render(<InjectionModal {...options} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose DLL' }));
  await screen.findByText('DLL: D:\\My loaders\\custom.dll');
  fireEvent.click(screen.getByRole('button', { name: 'Inject into running Lunar' }));
  await screen.findByText('LunarClient · PID 36648');
  fireEvent.click(screen.getByRole('button', { name: 'Inject' }));
  await waitFor(() => expect(options.onInject).toHaveBeenCalledOnce());
  expect(options.onInject.mock.calls[0].slice(0, 2)).toEqual([
    'detect',
    { target: '36648', dllPath: 'D:\\My loaders\\custom.dll' },
  ]);
});

it('shows startup errors without reporting injection success', async () => {
  const options = props();
  options.onStartLunar.mockRejectedValueOnce(new Error('The selected JAR was moved.'));
  render(<InjectionModal {...options} />);
  fireEvent.click(screen.getByRole('button', { name: 'Watch next Lunar startup' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toContain('The selected JAR was moved.');
  expect(screen.queryByText('Injection successful')).toBeNull();
  expect(options.onInject).not.toHaveBeenCalled();
});
