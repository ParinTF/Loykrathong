import { WebSocketServer } from 'ws';

const MAX_ROOMS = 400;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB (fits compact avatar dataUrl + state)

const DEFAULT_PLAYERS = {
  p1: {
    id: 'p1',
    name: 'ฟ้าใส',
    customization: {
      skinTone: 'warm-ivory',
      hairStyle: 'long-silky',
      hairColor: 'obsidian',
      outfit: 'silk-lotus',
    },
    portrait: {
      status: 'absent',
      dataUrl: null,
      mimeType: null,
      error: null,
      updatedAt: null,
    },
    position: { x: 690, y: 585, facing: 'up' },
  },
  p2: {
    id: 'p2',
    name: 'ต้นกล้า',
    customization: {
      skinTone: 'golden-tan',
      hairStyle: 'short-classic',
      hairColor: 'espresso',
      outfit: 'chut-thai-gold',
    },
    portrait: {
      status: 'absent',
      dataUrl: null,
      mimeType: null,
      error: null,
      updatedAt: null,
    },
    position: { x: 750, y: 585, facing: 'up' },
  },
};

function createDefaultSharedState() {
  return {
    inventory: {
      'banana-leaf': false,
      'lotus-blossom': false,
      'candle-incense': false,
    },
    litLanternIds: [],
    pavilionBlessed: false,
    contributedBy: { p1: 0, p2: 0 },
    questStage: 'explore',
    minigames: {
      recipe: { status: 'pending', score: 0, attempts: 0 },
      assembly: { status: 'pending', score: 0, attempts: 0 },
      rhythm: { status: 'pending', score: 0, attempts: 0 },
    },
    krathongCrafted: false,
    coopTasks: {},
    krathongDesign: {
      base: 'classic-banana',
      flower: 'pink-lotus',
      glow: 'amber-candle',
      wishText: 'ขอให้เราสองคนเดินเคียงข้างกันอย่างอบอุ่นในทุกเทศกาล แม้ในวันที่อยู่ไกลกัน',
    },
    releasedKrathongs: [],
    lastEventLog: 'เปิดห้องลอยกระทงออนไลน์แล้ว ส่งรหัสหรือลิงก์ให้แฟนเข้ามาเดินคู่กันได้เลย!',
  };
}

export function normalizeRoomCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function sanitizeProfile(incoming, slotId, fallback) {
  if (!incoming || typeof incoming !== 'object') return structuredClone(fallback);
  const name =
    typeof incoming.name === 'string' && incoming.name.trim()
      ? incoming.name.trim().slice(0, 24)
      : fallback.name;
  const cust = incoming.customization && typeof incoming.customization === 'object'
    ? {
        skinTone: String(incoming.customization.skinTone || fallback.customization.skinTone),
        hairStyle: String(incoming.customization.hairStyle || fallback.customization.hairStyle),
        hairColor: String(incoming.customization.hairColor || fallback.customization.hairColor),
        outfit: String(incoming.customization.outfit || fallback.customization.outfit),
      }
    : structuredClone(fallback.customization);

  let portrait = structuredClone(fallback.portrait);
  if (incoming.portrait && typeof incoming.portrait === 'object') {
    const dataUrl =
      typeof incoming.portrait.dataUrl === 'string' &&
      incoming.portrait.dataUrl.startsWith('data:image/') &&
      incoming.portrait.dataUrl.length <= 360_000
        ? incoming.portrait.dataUrl
        : null;
    portrait = {
      status: dataUrl ? 'ready' : 'absent',
      dataUrl,
      mimeType: dataUrl && typeof incoming.portrait.mimeType === 'string'
        ? incoming.portrait.mimeType.slice(0, 32)
        : null,
      error: null,
      updatedAt:
        typeof incoming.portrait.updatedAt === 'string'
          ? incoming.portrait.updatedAt.slice(0, 48)
          : null,
    };
  }

  const pos = incoming.position && typeof incoming.position === 'object'
    ? {
        x: Number.isFinite(incoming.position.x)
          ? Math.max(32, Math.min(1408, Number(incoming.position.x)))
          : fallback.position.x,
        y: Number.isFinite(incoming.position.y)
          ? Math.max(56, Math.min(840, Number(incoming.position.y)))
          : fallback.position.y,
        facing: ['up', 'down', 'left', 'right'].includes(incoming.position.facing)
          ? incoming.position.facing
          : fallback.position.facing,
      }
    : structuredClone(fallback.position);

  return {
    id: slotId,
    name,
    customization: cust,
    portrait,
    position: pos,
  };
}

export function createRoomHub() {
  /** @type {Map<string, any>} */
  const rooms = new Map();

  function pruneExpiredRooms() {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      const hasOpenSocket =
        Boolean(room.sockets.p1 && room.sockets.p1.readyState === 1) ||
        Boolean(room.sockets.p2 && room.sockets.p2.readyState === 1);
      if (!hasOpenSocket && now - room.updatedAt > ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
    if (rooms.size > MAX_ROOMS) {
      for (const [code, room] of rooms.entries()) {
        const hasOpenSocket =
          Boolean(room.sockets.p1 && room.sockets.p1.readyState === 1) ||
          Boolean(room.sockets.p2 && room.sockets.p2.readyState === 1);
        if (!hasOpenSocket) {
          rooms.delete(code);
          if (rooms.size <= MAX_ROOMS) break;
        }
      }
    }
  }

  function getOrCreateRoom(code) {
    pruneExpiredRooms();
    let room = rooms.get(code);
    if (!room) {
      room = {
        code,
        players: structuredClone(DEFAULT_PLAYERS),
        shared: createDefaultSharedState(),
        sockets: { p1: null, p2: null },
        clientIds: { p1: null, p2: null },
        updatedAt: Date.now(),
      };
      rooms.set(code, room);
    }
    return room;
  }

  function getOccupancy(room) {
    return {
      p1: Boolean(room.sockets.p1 && room.sockets.p1.readyState === 1),
      p2: Boolean(room.sockets.p2 && room.sockets.p2.readyState === 1),
    };
  }

  function sendJson(ws, payload) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  function broadcastRoomSnapshot(room, eventNote) {
    room.updatedAt = Date.now();
    if (eventNote) {
      room.shared.lastEventLog = eventNote;
    }
    const payload = {
      type: 'room_snapshot',
      roomCode: room.code,
      occupancy: getOccupancy(room),
      players: room.players,
      shared: room.shared,
    };
    sendJson(room.sockets.p1, payload);
    sendJson(room.sockets.p2, payload);
  }

  function attachToServer(httpServer) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

    httpServer.on('upgrade', (request, socket, head) => {
      try {
        const url = new URL(request.url || '/', 'http://localhost');
        if (url.pathname !== '/ws') {
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch {
        socket.destroy();
      }
    });

    wss.on('connection', (ws) => {
      let joinedRoom = null;
      let assignedRole = null;

      ws.on('message', (rawBuf) => {
        let msg;
        try {
          msg = JSON.parse(String(rawBuf));
        } catch {
          return;
        }
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'ping') {
          sendJson(ws, { type: 'pong', ts: Date.now() });
          return;
        }

        if (msg.type === 'join_room') {
          const code = normalizeRoomCode(msg.roomCode);
          if (code.length < 4) {
            sendJson(ws, {
              type: 'room_error',
              code: 'invalid_code',
              message: 'รหัสห้องต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลขอย่างน้อย 4 ตัว',
            });
            return;
          }

          const room = getOrCreateRoom(code);
          const clientId = typeof msg.clientId === 'string' ? msg.clientId.slice(0, 64) : '';
          const preferred = msg.preferredRole === 'p2' ? 'p2' : 'p1';
          const other = preferred === 'p1' ? 'p2' : 'p1';
          const occ = getOccupancy(room);

          let role = null;
          if (clientId && room.clientIds.p1 === clientId) {
            role = 'p1';
          } else if (clientId && room.clientIds.p2 === clientId) {
            role = 'p2';
          } else if (!occ[preferred]) {
            role = preferred;
          } else if (!occ[other]) {
            role = other;
          }

          if (!role) {
            sendJson(ws, {
              type: 'room_error',
              code: 'room_full',
              message: 'ห้องนี้มีผู้เล่นครบ 2 คนแล้ว กรุณาตรวจสอบรหัสห้องหรือสร้างห้องใหม่',
            });
            return;
          }

          // Close stale socket if same clientId reconnected
          if (room.sockets[role] && room.sockets[role] !== ws) {
            try {
              room.sockets[role].close();
            } catch {
              // ignore
            }
          }

          joinedRoom = room;
          assignedRole = role;
          room.sockets[role] = ws;
          room.clientIds[role] = clientId || null;

          if (msg.profile) {
            const existingPos = room.players[role].position;
            const mergedProfile = sanitizeProfile(
              msg.profile,
              role,
              room.players[role]
            );
            // Keep existing room position if reconnecting unless explicitly in world
            mergedProfile.position = msg.preserveRoomPosition
              ? existingPos
              : mergedProfile.position;
            room.players[role] = mergedProfile;
          }

          sendJson(ws, {
            type: 'joined_room',
            roomCode: room.code,
            role,
            occupancy: getOccupancy(room),
            players: room.players,
            shared: room.shared,
          });

          const joinName = room.players[role].name;
          const bothHere = getOccupancy(room).p1 && getOccupancy(room).p2;
          broadcastRoomSnapshot(
            room,
            bothHere
              ? `${room.players.p1.name} และ ${room.players.p2.name} เชื่อมต่ออยู่ในห้องเดียวกันครบแล้ว!`
              : `${joinName} เข้าสู่ห้อง ${room.code} แล้ว กำลังรอคู่รักอีกฝ่ายเข้ามา...`
          );
          return;
        }

        if (!joinedRoom || !assignedRole) return;

        if (msg.type === 'update_profile' && msg.profile) {
          const prevPos = joinedRoom.players[assignedRole].position;
          const updated = sanitizeProfile(
            msg.profile,
            assignedRole,
            joinedRoom.players[assignedRole]
          );
          updated.position = msg.profile.position ? updated.position : prevPos;
          joinedRoom.players[assignedRole] = updated;
          joinedRoom.updatedAt = Date.now();

          const partnerRole = assignedRole === 'p1' ? 'p2' : 'p1';
          sendJson(joinedRoom.sockets[partnerRole], {
            type: 'peer_profile',
            playerId: assignedRole,
            profile: updated,
          });
          return;
        }

        if (msg.type === 'move' && msg.position) {
          const cur = joinedRoom.players[assignedRole];
          const nextPos = {
            x: Number.isFinite(msg.position.x)
              ? Math.max(32, Math.min(1408, Number(msg.position.x)))
              : cur.position.x,
            y: Number.isFinite(msg.position.y)
              ? Math.max(56, Math.min(840, Number(msg.position.y)))
              : cur.position.y,
            facing: ['up', 'down', 'left', 'right'].includes(msg.position.facing)
              ? msg.position.facing
              : cur.position.facing,
          };
          cur.position = nextPos;
          joinedRoom.updatedAt = Date.now();

          const partnerRole = assignedRole === 'p1' ? 'p2' : 'p1';
          sendJson(joinedRoom.sockets[partnerRole], {
            type: 'peer_moved',
            playerId: assignedRole,
            position: nextPos,
          });
          return;
        }

        if (msg.type === 'sync_shared' && msg.shared && typeof msg.shared === 'object') {
          joinedRoom.shared = {
            ...joinedRoom.shared,
            ...msg.shared,
          };
          broadcastRoomSnapshot(joinedRoom);
          return;
        }

        if (msg.type === 'send_emote') {
          const emoji = typeof msg.emoji === 'string' ? msg.emoji.slice(0, 8) : '💖';
          const text = typeof msg.text === 'string' ? msg.text.slice(0, 48) : 'ส่งหัวใจให้แฟน';
          const senderName = joinedRoom.players[assignedRole].name;
          joinedRoom.shared.lastEventLog = `${senderName}: ${emoji} ${text}`;
          const payload = {
            type: 'emote',
            playerId: assignedRole,
            emoji,
            text,
            ts: Date.now(),
          };
          sendJson(joinedRoom.sockets.p1, payload);
          sendJson(joinedRoom.sockets.p2, payload);
          return;
        }
      });

      ws.on('close', () => {
        if (!joinedRoom || !assignedRole) return;
        if (joinedRoom.sockets[assignedRole] === ws) {
          joinedRoom.sockets[assignedRole] = null;
          const leftName = joinedRoom.players[assignedRole]?.name || assignedRole;
          broadcastRoomSnapshot(
            joinedRoom,
            `${leftName} พักการเชื่อมต่อชั่วคราว (เข้าลิงก์เดิมเพื่อกลับมาเดินต่อได้ทันที)`
          );
        }
      });
    });

    return wss;
  }

  return {
    attachToServer,
    rooms,
  };
}
