import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
// @ts-expect-error -- ESM server room hub
import { createRoomHub } from '../server/roomHub.mjs';
import { createInitialGameState } from '../src/domain/reducer';
import { OnlineRoomClient, createSeatKey } from '../src/online/roomClient';

describe('Real-Time Online Room Hub, Invitations & Blind Fortune Sync', () => {
  it('supports create_room, GET /api/invitations/:code, join_room, real-time move, and masks Blind Fortune answers until both lock', async () => {
    const hub = createRoomHub();
    const server = createServer((req, res) => {
      if (hub.handleInvitation(req, res)) return;
      res.writeHead(404);
      res.end();
    });
    hub.attachToServer(server);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const wsUrl = `ws://127.0.0.1:${port}/ws`;

    const waitMessage = (
      ws: WebSocket,
      predicate: (msg: Record<string, unknown>) => boolean
    ) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('WS timeout')), 4000);
        const handler = (raw: Buffer) => {
          const parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
          if (predicate(parsed)) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(parsed);
          }
        };
        ws.on('message', handler);
      });

    const p1Ws = new WebSocket(wsUrl);
    const p2Ws = new WebSocket(wsUrl);

    try {
      await Promise.all([
        new Promise((res) => p1Ws.once('open', res)),
        new Promise((res) => p2Ws.once('open', res)),
      ]);

      // 1. P1 creates a private room
      const p1JoinedPromise = waitMessage(p1Ws, (m) => m.type === 'joined_room');
      p1Ws.send(
        JSON.stringify({
          type: 'create_room',
          seatKey: createSeatKey(),
          profile: { name: 'มินตรา' },
        })
      );
      const p1Joined = await p1JoinedPromise;
      const roomCode = String(p1Joined.roomCode);
      expect(p1Joined.role).toBe('p1');
      expect(roomCode).toMatch(/^[a-f0-9]{24}$/);

      // 2. Partner inspects invitation via HTTP endpoint
      const invRes = await fetch(`http://127.0.0.1:${port}/api/invitations/${roomCode}`);
      expect(invRes.status).toBe(200);
      const invJson = (await invRes.json()) as { hostName: string };
      expect(invJson.hostName).toBe('มินตรา');

      // 3. P2 joins the private room
      const p2JoinedPromise = waitMessage(p2Ws, (m) => m.type === 'joined_room');
      p2Ws.send(
        JSON.stringify({
          type: 'join_room',
          roomCode,
          seatKey: createSeatKey(),
          profile: { name: 'ภาคิน' },
        })
      );
      const p2Joined = await p2JoinedPromise;
      expect(p2Joined.role).toBe('p2');
      expect(p2Joined.occupancy).toEqual({ p1: true, p2: true });

      // 4. Real-time movement relay
      const peerMovedPromise = waitMessage(p2Ws, (m) => m.type === 'peer_moved');
      p1Ws.send(
        JSON.stringify({
          type: 'move',
          position: { x: 940, y: 760, facing: 'down' },
        })
      );
      const movedMsg = await peerMovedPromise;
      expect(movedMsg.playerId).toBe('p1');
      expect((movedMsg.position as { y: number }).y).toBe(760);

      // 5. Blind Fortune Paper: P1 locks answer -> P2 receives p1Locked=true BUT masked p1Answer=''!
      const p2SecretSnapPromise = waitMessage(
        p2Ws,
        (m) =>
          m.type === 'room_snapshot' &&
          Boolean((m.shared as { fortunePaper?: { p1Locked: boolean } })?.fortunePaper?.p1Locked)
      );
      p1Ws.send(
        JSON.stringify({
          type: 'sync_shared',
          shared: {
            fortunePaper: {
              promptIndex: 0,
              p1Answer: 'ความลับของมินตรา',
              p2Answer: '',
              p1Locked: true,
              p2Locked: false,
              revealed: false,
              completed: false,
            },
          },
        })
      );
      const p2SecretSnap = await p2SecretSnapPromise;
      const maskedFp = (p2SecretSnap.shared as { fortunePaper: Record<string, unknown> })
        .fortunePaper;
      expect(maskedFp.p1Locked).toBe(true);
      expect(maskedFp.p1Answer).toBe('');
      expect(maskedFp.revealed).toBe(false);

      // 6. P2 locks answer -> BOTH receive revealed=true with BOTH answers intact!
      const p1RevealPromise = waitMessage(
        p1Ws,
        (m) =>
          m.type === 'room_snapshot' &&
          Boolean((m.shared as { fortunePaper?: { revealed: boolean } })?.fortunePaper?.revealed)
      );
      p2Ws.send(
        JSON.stringify({
          type: 'sync_shared',
          shared: {
            fortunePaper: {
              promptIndex: 0,
              p1Answer: '',
              p2Answer: 'ความลับของภาคิน',
              p1Locked: true,
              p2Locked: true,
              revealed: false,
              completed: false,
            },
          },
        })
      );
      const revealedSnap = await p1RevealPromise;
      const revealedFp = (revealedSnap.shared as { fortunePaper: Record<string, unknown> })
        .fortunePaper;
      expect(revealedFp.revealed).toBe(true);
      expect(revealedFp.p1Answer).toBe('ความลับของมินตรา');
      expect(revealedFp.p2Answer).toBe('ความลับของภาคิน');

      // 7. Online Couple Photo Booth: P1 streams live camera frame -> P2 receives it; synchronized shutter broadcasts to BOTH!
      const p2FramePromise = waitMessage(p2Ws, (m) => m.type === 'photobooth_frame');
      p1Ws.send(
        JSON.stringify({
          type: 'photobooth_frame',
          dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          mirrored: true,
          filter: 'warm-candle',
        })
      );
      const p2Frame = await p2FramePromise;
      expect(p2Frame.playerId).toBe('p1');
      expect(p2Frame.filter).toBe('warm-candle');

      const p1ShutterPromise = waitMessage(p1Ws, (m) => m.type === 'photobooth_shutter');
      const p2ShutterPromise = waitMessage(p2Ws, (m) => m.type === 'photobooth_shutter');
      p1Ws.send(
        JSON.stringify({
          type: 'photobooth_shutter',
          sessionId: 'pb-test-4cut',
          layout: 'strip-4',
          backdrop: 'sala',
          pose: 'heart-hands',
          caption: 'คืนเพ็ญข้ามระยะทาง',
        })
      );
      const [s1, s2] = await Promise.all([p1ShutterPromise, p2ShutterPromise]);
      expect(s1.sessionId).toBe('pb-test-4cut');
      expect(s2.layout).toBe('strip-4');
    } finally {
      p1Ws.close();
      p2Ws.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('keeps the replacement connection open when the previous socket closes (anti-flicker stability)', async () => {
    const server = createServer();
    const hub = createRoomHub();
    hub.attachToServer(server);

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const wsEndpoint = `ws://127.0.0.1:${port}/ws`;

    const statusHistory: string[] = [];
    let joinedCount = 0;
    const state = createInitialGameState();

    const origWs = globalThis.WebSocket;
    globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

    const client = new OnlineRoomClient(
      () => state.players.p1,
      {
        onJoined: () => {
          joinedCount += 1;
        },
        onSnapshot: () => {},
        onPeerMoved: () => {},
        onPeerProfile: () => {},
        onEmote: () => {},
        onCoopSignal: () => {},
        onStatusChange: (st) => {
          statusHistory.push(st);
        },
      },
      wsEndpoint
    );

    try {
      client.connect({ type: 'create_room', seatKey: createSeatKey() });
      await vi.waitFor(() => expect(joinedCount).toBe(1));
      client.connect({ type: 'create_room', seatKey: createSeatKey() });
      await vi.waitFor(() => expect(joinedCount).toBe(2));

      await new Promise((resolve) => setTimeout(resolve, 1600));

      expect(joinedCount).toBe(2);
      expect(statusHistory).toEqual([
        'connecting',
        'connected',
        'connecting',
        'connected',
      ]);
    } finally {
      client.disconnect();
      globalThis.WebSocket = origWs;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
