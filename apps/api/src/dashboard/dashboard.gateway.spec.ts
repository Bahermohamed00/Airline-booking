import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardGateway } from './dashboard.gateway';
import type { Socket } from 'socket.io';

describe('DashboardGateway', () => {
  const jwt = { verifyAsync: vi.fn() };
  const jwtStrategy = { validate: vi.fn() };
  const events = { subscribe: vi.fn().mockReturnValue(vi.fn()) };
  let gateway: DashboardGateway;

  const socketOf = (token?: string) =>
    ({
      handshake: token === undefined ? { auth: {}, headers: {} } : { auth: { token }, headers: {} },
      data: {} as Record<string, unknown>,
      disconnect: vi.fn(),
    }) as unknown as Socket;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new DashboardGateway(jwt as never, jwtStrategy as never, events as never);
  });

  it('forwards bus events to connected clients as pure invalidation notifications', () => {
    const emit = vi.fn();
    (gateway as unknown as { server: { emit: typeof emit } }).server = { emit };
    gateway.onModuleInit();

    const handler = events.subscribe.mock.calls[0]![0] as (e: { type: string; at: string }) => void;
    handler({ type: 'flight.created', at: '2026-10-07T00:00:00Z' });

    expect(emit).toHaveBeenCalledWith('dashboard.invalidate', {
      type: 'flight.created',
      at: '2026-10-07T00:00:00Z',
    });
  });

  it('connects a client with a valid token and dashboard:read', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', sid: 's1', type: 'access' });
    jwtStrategy.validate.mockResolvedValue({ userId: 'u1', roles: ['Flight Manager'], permissions: ['dashboard:read'] });
    const socket = socketOf('valid-token');

    await gateway.handleConnection(socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.data['user']).toEqual({ userId: 'u1', roles: ['Flight Manager'] });
  });

  it('connects via the super_admin bypass', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'root', sid: 's1', type: 'access' });
    jwtStrategy.validate.mockResolvedValue({ userId: 'root', roles: ['Super Admin'], permissions: ['super_admin'] });

    const socket = socketOf('valid-token');
    await gateway.handleConnection(socket);

    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects when the token is missing, invalid, or the session check fails', async () => {
    const noToken = socketOf(undefined);
    await gateway.handleConnection(noToken);
    expect(noToken.disconnect).toHaveBeenCalledWith(true);

    jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));
    const badToken = socketOf('garbage');
    await gateway.handleConnection(badToken);
    expect(badToken.disconnect).toHaveBeenCalledWith(true);

    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', sid: 's1', type: 'access' });
    jwtStrategy.validate.mockRejectedValue(new Error('Session expired or revoked'));
    const revoked = socketOf('valid-but-revoked');
    await gateway.handleConnection(revoked);
    expect(revoked.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects an authenticated user without dashboard:read (RBAC applies to WS too)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u2', sid: 's2', type: 'access' });
    jwtStrategy.validate.mockResolvedValue({ userId: 'u2', roles: ['Customer'], permissions: [] });

    const socket = socketOf('valid-token');
    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
});
