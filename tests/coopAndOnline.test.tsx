import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
// @ts-expect-error -- ESM server room hub
import { createRoomHub } from '../server/roomHub.mjs';
import { InteractionModal } from '../src/components/InteractionModal';
import { createInitialGameState, gameReducer } from '../src/domain/reducer';
import { OnlineRoomClient } from '../src/online/roomClient';

function ModalCoopHarness() {
  const [state, setState] = useState(() => {
    const base = createInitialGameState();
    return gameReducer(base, { type: 'ENTER_WORLD' });
  });

  return (
    <InteractionModal
      spotId="gather-lotus"
      state={state}
      playMode="local"
      reducedMotion={true}
      onClose={() => {}}
      onSwitchLocalPlayer={(pid) =>
        setState((s) => gameReducer(s, { type: 'SET_ACTIVE_PLAYER', playerId: pid }))
      }
      onRecordCoopHalf={(taskKey, playerId, halfScore) =>
        setState((s) =>
          gameReducer(s, { type: 'RECORD_COOP_HALF', taskKey, playerId, halfScore })
        )
      }
      onCollectMaterial={(material, message) =>
        setState((s) =>
          gameReducer(s, {
            type: 'COLLECT_MATERIAL',
            material,
            byPlayer: s.settings.activePlayer,
            message,
          })
        )
      }
      onLightLantern={(lanternId) =>
        setState((s) =>
          gameReducer(s, { type: 'LIGHT_LANTERN', lanternId, byPlayer: 'p1' })
        )
      }
      onBlessPavilion={() =>
        setState((s) => gameReducer(s, { type: 'BLESS_PAVILION', byPlayer: 'p1' }))
      }
      onCompleteMinigame={() => {}}
      onResetMinigame={() => {}}
      onUpdateKrathongDesign={() => {}}
      onCraftKrathong={() => {}}
      onReleaseKrathong={() => {}}
      onStartAnother={() => {}}
    />
  );
}

describe('2-Player Cooperative Challenges & Real-Time Online Room Hub', () => {
  it('requires BOTH Player 1 and Player 2 to complete the lotus pond challenge before unlocking lotus-blossom', () => {
    vi.useFakeTimers();
    try {
      render(<ModalCoopHarness />);

      // P1 starts and catches 3 blooming lotuses
      fireEvent.click(screen.getByRole('button', { name: /เริ่มพายเรือเก็บดอกบัว/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /บัวบาน! เก็บเลย/i })[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /บัวบาน! เก็บเลย/i })[0]);

      act(() => {
        vi.advanceTimersByTime(1300);
      });
      fireEvent.click(screen.getAllByRole('button', { name: /บัวบาน! เก็บเลย/i })[0]);

      // P1 is done, but P2 hasn't played yet -> reward must NOT be unlocked yet!
      expect(screen.getByText(/ผ่านส่วนของคุณแล้ว/i)).toBeInTheDocument();
      expect(screen.queryByText(/ทั้งคู่ช่วยกันคว้า/i)).not.toBeInTheDocument();

      // Switch to P2 and complete P2's 3 blooming lotuses
      fireEvent.click(screen.getByRole('button', { name: /ต้นกล้า \(P2\)/i }));
      fireEvent.click(screen.getByRole('button', { name: /เริ่มพายเรือเก็บดอกบัว/i }));
      fireEvent.click(screen.getAllByRole('button', { name: /บัวบาน! เก็บเลย/i })[0]);
      fireEvent.click(screen.getAllByRole('button', { name: /บัวบาน! เก็บเลย/i })[0]);

      act(() => {
        vi.advanceTimersByTime(1300);
      });
      fireEvent.click(screen.getAllByRole('button', { name: /บัวบาน! เก็บเลย/i })[0]);

      // Now BOTH P1 and P2 finished -> reward unlocks!
      expect(screen.getByText(/ทั้งคู่ช่วยกันคว้า/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('synchronizes two long-distance partners over WebSocket without overwriting concurrent co-op progress', async () => {
    const server = createServer();
    const hub = createRoomHub();
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

      const p1JoinedPromise = waitMessage(p1Ws, (m) => m.type === 'joined_room');
      p1Ws.send(
        JSON.stringify({
          type: 'join_room',
          roomCode: 'LOVE99',
          preferredRole: 'p1',
          clientId: 'test-client-p1',
          profile: { name: 'มินตรา' },
        })
      );
      const p1Joined = await p1JoinedPromise;
      expect(p1Joined.role).toBe('p1');

      const p2JoinedPromise = waitMessage(p2Ws, (m) => m.type === 'joined_room');
      p2Ws.send(
        JSON.stringify({
          type: 'join_room',
          roomCode: 'LOVE99',
          preferredRole: 'p2',
          clientId: 'test-client-p2',
          profile: { name: 'ภาคิน' },
        })
      );
      const p2Joined = await p2JoinedPromise;
      expect(p2Joined.role).toBe('p2');
      expect(p2Joined.occupancy).toEqual({ p1: true, p2: true });

      // Real-time movement relay from P1 to P2
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

      // Concurrent co-op task completion from P1 and P2 must merge cleanly into BOTH done!
      p1Ws.send(
        JSON.stringify({
          type: 'sync_shared',
          shared: {
            coopTasks: {
              'gather-lotus': {
                p1Done: true,
                p2Done: false,
                p1Score: 48,
                p2Score: 0,
              },
            },
          },
        })
      );
      const mergedSnapshotPromise = waitMessage(
        p1Ws,
        (m) =>
          m.type === 'room_snapshot' &&
          Boolean(
            (
              m.shared as {
                coopTasks?: Record<string, { p1Done: boolean; p2Done: boolean }>;
              }
            )?.coopTasks?.['gather-lotus']?.p2Done
          )
      );
      p2Ws.send(
        JSON.stringify({
          type: 'sync_shared',
          shared: {
            coopTasks: {
              'gather-lotus': {
                p1Done: false,
                p2Done: true,
                p1Score: 0,
                p2Score: 50,
              },
            },
          },
        })
      );

      const merged = await mergedSnapshotPromise;
      const lotusTask = (
        merged.shared as {
          coopTasks: Record<string, { p1Done: boolean; p2Done: boolean }>;
        }
      ).coopTasks['gather-lotus'];
      expect(lotusTask.p1Done).toBe(true);
      expect(lotusTask.p2Done).toBe(true);
    } finally {
      p1Ws.close();
      p2Ws.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('keeps the replacement connection open when the previous socket closes', async () => {
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
        onStatusChange: (st) => {
          statusHistory.push(st);
        },
      },
      { wsEndpoint }
    );

    try {
      client.connect('STABLE1', 'p1');
      await vi.waitFor(() => expect(joinedCount).toBe(1));
      client.connect('STABLE1', 'p2');
      await vi.waitFor(() => expect(joinedCount).toBe(2));

      // A close from the previous socket used to schedule another connection.
      await new Promise((resolve) => setTimeout(resolve, 2300));

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
