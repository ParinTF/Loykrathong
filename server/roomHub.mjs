import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const MAX_ROOMS = 400;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PAYLOAD_BYTES = 512 * 1024;
const ROOM_CODE_RE = /^[a-f0-9]{24}$/;
const SEAT_KEY_RE = /^[a-f0-9]{32}$/;

const DEFAULT_PLAYERS = {
  p1: {
    id: 'p1',
    name: 'ฟ้าใส',
    customization: {
      gender: 'female',
      skinTone: 'warm-ivory',
      hairStyle: 'long-silky',
      hairColor: 'obsidian',
      outfit: 'silk-lotus',
      accessory: 'none',
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
      gender: 'male',
      skinTone: 'golden-tan',
      hairStyle: 'short-classic',
      hairColor: 'espresso',
      outfit: 'chut-thai-gold',
      accessory: 'none',
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
    lotusBoat: {
      rower: 'p1',
      boatX: 16,
      boatY: 52,
      boatAngle: 0,
      collectedIds: [],
      completed: false,
    },
    leafRelay: {
      cutter: 'p1',
      cutStep: 0,
      currentShape: 'swan',
      passedLeafReady: false,
      foldStep: 0,
      finishedPetals: [],
      completed: false,
    },
    fortunePaper: {
      promptIndex: 0,
      p1Answer: '',
      p2Answer: '',
      p1Locked: false,
      p2Locked: false,
      revealed: false,
      completed: false,
    },
    skyLantern: {
      p1Wish: '',
      p2Wish: '',
      p1Lit: false,
      p2Lit: false,
      p1ReadyRelease: false,
      p2ReadyRelease: false,
      released: false,
      releasedAt: null,
    },
    activePose: 'sit-moon',
    photoMemories: [],
    pierCeremony: {
      p1Ready: false,
      p2Ready: false,
    },
    krathongCrafted: false,
    krathongDesign: {
      base: 'classic-banana',
      flower: 'pink-lotus',
      glow: 'amber-candle',
      wishText:
        'ขอให้เราสองคนเดินเคียงข้างกันอย่างอบอุ่นในทุกเทศกาล แม้ในวันที่อยู่ไกลกัน',
      decorations: [
        { id: 'init-1', kind: 'pink-lotus', x: 36, y: 48, scale: 1, placedBy: 'p1' },
        { id: 'init-2', kind: 'pink-lotus', x: 64, y: 48, scale: 1, placedBy: 'p2' },
        { id: 'init-3', kind: 'candle-spark', x: 50, y: 44, scale: 1.05, placedBy: 'p1' },
      ],
    },
    releasedKrathongs: [],
    questStage: 'explore',
    lastEventLog:
      'เปิดห้องลอยกระทงออนไลน์แล้ว ส่งลิงก์คำเชิญให้คนพิเศษเข้ามาเดินชมคืนเพ็ญด้วยกันได้เลย',
  };
}

function mergeSharedState(prev, incoming, options = {}) {
  if (!incoming || typeof incoming !== 'object') return prev;
  if (options.forceReplace) {
    return {
      ...createDefaultSharedState(),
      ...incoming,
    };
  }

  const senderRole = options.senderRole;

  const nextInventory = {
    'banana-leaf': Boolean(
      prev.inventory?.['banana-leaf'] || incoming.inventory?.['banana-leaf']
    ),
    'lotus-blossom': Boolean(
      prev.inventory?.['lotus-blossom'] || incoming.inventory?.['lotus-blossom']
    ),
    'candle-incense': Boolean(
      prev.inventory?.['candle-incense'] || incoming.inventory?.['candle-incense']
    ),
  };

  // Activity 01: Boat Lotus Gathering
  const prevBoat = prev.lotusBoat || createDefaultSharedState().lotusBoat;
  const incBoat = incoming.lotusBoat || prevBoat;
  const boatCollected = Array.from(
    new Set([
      ...(Array.isArray(prevBoat.collectedIds) ? prevBoat.collectedIds : []),
      ...(Array.isArray(incBoat.collectedIds) ? incBoat.collectedIds : []),
    ])
  );
  const nextLotusBoat = {
    rower: incBoat.rower === 'p2' ? 'p2' : 'p1',
    boatX: Number.isFinite(incBoat.boatX) ? incBoat.boatX : prevBoat.boatX,
    boatY: Number.isFinite(incBoat.boatY) ? incBoat.boatY : prevBoat.boatY,
    boatAngle: Number.isFinite(incBoat.boatAngle)
      ? incBoat.boatAngle
      : prevBoat.boatAngle,
    collectedIds: boatCollected,
    completed: Boolean(prevBoat.completed || incBoat.completed || boatCollected.length >= 5),
  };

  // Activity 02: Banana Leaf Relay
  const prevLeaf = prev.leafRelay || createDefaultSharedState().leafRelay;
  const incLeaf = incoming.leafRelay || prevLeaf;
  const finishedPetals = Array.from(
    new Set([
      ...(Array.isArray(prevLeaf.finishedPetals) ? prevLeaf.finishedPetals : []),
      ...(Array.isArray(incLeaf.finishedPetals) ? incLeaf.finishedPetals : []),
    ])
  );
  const nextLeafRelay = {
    cutter: incLeaf.cutter === 'p2' ? 'p2' : 'p1',
    cutStep: Number.isFinite(incLeaf.cutStep) ? incLeaf.cutStep : prevLeaf.cutStep,
    currentShape: incLeaf.currentShape || prevLeaf.currentShape,
    passedLeafReady: Boolean(incLeaf.passedLeafReady),
    foldStep: Number.isFinite(incLeaf.foldStep) ? incLeaf.foldStep : prevLeaf.foldStep,
    finishedPetals,
    completed: Boolean(prevLeaf.completed || incLeaf.completed || finishedPetals.length >= 3),
  };

  // Activity 03: Blind Fortune Paper Q&A (conflict-free concurrent p1/p2 merge)
  const prevFp = prev.fortunePaper || createDefaultSharedState().fortunePaper;
  const incFp = incoming.fortunePaper || prevFp;
  const promptChanged =
    typeof incFp.promptIndex === 'number' && incFp.promptIndex !== prevFp.promptIndex;

  let nextFortunePaper;
  if (promptChanged) {
    nextFortunePaper = {
      promptIndex: incFp.promptIndex,
      p1Answer: String(incFp.p1Answer || '').slice(0, 140),
      p2Answer: String(incFp.p2Answer || '').slice(0, 140),
      p1Locked: Boolean(incFp.p1Locked),
      p2Locked: Boolean(incFp.p2Locked),
      revealed: Boolean(incFp.revealed),
      completed: Boolean(prevFp.completed || incFp.completed),
    };
  } else {
    const p1Answer =
      senderRole === 'p2'
        ? prevFp.p1Answer
        : prevFp.p1Locked
          ? prevFp.p1Answer
          : typeof incFp.p1Answer === 'string' && incFp.p1Answer.length > 0
            ? incFp.p1Answer.slice(0, 140)
            : prevFp.p1Answer;
    const p2Answer =
      senderRole === 'p1'
        ? prevFp.p2Answer
        : prevFp.p2Locked
          ? prevFp.p2Answer
          : typeof incFp.p2Answer === 'string' && incFp.p2Answer.length > 0
            ? incFp.p2Answer.slice(0, 140)
            : prevFp.p2Answer;
    const p1Locked = Boolean(prevFp.p1Locked || (senderRole !== 'p2' && incFp.p1Locked));
    const p2Locked = Boolean(prevFp.p2Locked || (senderRole !== 'p1' && incFp.p2Locked));
    const revealed = Boolean(prevFp.revealed || incFp.revealed || (p1Locked && p2Locked));
    nextFortunePaper = {
      promptIndex: prevFp.promptIndex,
      p1Answer,
      p2Answer,
      p1Locked,
      p2Locked,
      revealed,
      completed: Boolean(prevFp.completed || incFp.completed || revealed),
    };
    if (revealed) {
      nextInventory['candle-incense'] = true;
    }
  }

  // Activity 04: Single Sky Lantern
  const prevLantern = prev.skyLantern || createDefaultSharedState().skyLantern;
  const incLantern = incoming.skyLantern || prevLantern;
  const nextSkyLantern = {
    p1Wish:
      senderRole === 'p2'
        ? prevLantern.p1Wish
        : typeof incLantern.p1Wish === 'string'
          ? incLantern.p1Wish.slice(0, 110)
          : prevLantern.p1Wish,
    p2Wish:
      senderRole === 'p1'
        ? prevLantern.p2Wish
        : typeof incLantern.p2Wish === 'string'
          ? incLantern.p2Wish.slice(0, 110)
          : prevLantern.p2Wish,
    p1Lit: Boolean(prevLantern.p1Lit || incLantern.p1Lit),
    p2Lit: Boolean(prevLantern.p2Lit || incLantern.p2Lit),
    p1ReadyRelease: Boolean(prevLantern.p1ReadyRelease || incLantern.p1ReadyRelease),
    p2ReadyRelease: Boolean(prevLantern.p2ReadyRelease || incLantern.p2ReadyRelease),
    released: Boolean(prevLantern.released || incLantern.released),
    releasedAt: prevLantern.releasedAt || incLantern.releasedAt || null,
  };

  // Activity 07: Photo Memories (append-union by id, keep compact thumbnails safely bounded)
  const photoMap = new Map();
  for (const item of Array.isArray(prev.photoMemories) ? prev.photoMemories : []) {
    if (item && typeof item.id === 'string') photoMap.set(item.id, item);
  }
  for (const item of Array.isArray(incoming.photoMemories) ? incoming.photoMemories : []) {
    if (item && typeof item.id === 'string') {
      const safeComposite =
        typeof item.compositeDataUrl === 'string' &&
        item.compositeDataUrl.startsWith('data:image/') &&
        item.compositeDataUrl.length <= 360_000
          ? item.compositeDataUrl
          : null;
      photoMap.set(item.id, {
        ...item,
        compositeDataUrl: safeComposite,
      });
    }
  }

  // Activity 08: Pier Synchronized Release
  const prevPier = prev.pierCeremony || { p1Ready: false, p2Ready: false };
  const incPier = incoming.pierCeremony || prevPier;
  const nextPierCeremony = {
    p1Ready:
      senderRole === 'p2' ? Boolean(prevPier.p1Ready) : Boolean(incPier.p1Ready),
    p2Ready:
      senderRole === 'p1' ? Boolean(prevPier.p2Ready) : Boolean(incPier.p2Ready),
  };

  // Released Krathongs (append-union by id)
  const krathongMap = new Map();
  for (const item of Array.isArray(prev.releasedKrathongs) ? prev.releasedKrathongs : []) {
    if (item && typeof item.id === 'string') krathongMap.set(item.id, item);
  }
  for (const item of Array.isArray(incoming.releasedKrathongs)
    ? incoming.releasedKrathongs
    : []) {
    if (item && typeof item.id === 'string') krathongMap.set(item.id, item);
  }

  const nextKrathongDesign = incoming.krathongDesign
    ? {
        ...(prev.krathongDesign || createDefaultSharedState().krathongDesign),
        ...incoming.krathongDesign,
        decorations: Array.isArray(incoming.krathongDesign.decorations)
          ? incoming.krathongDesign.decorations.slice(0, 24)
          : prev.krathongDesign?.decorations ?? [],
      }
    : prev.krathongDesign;

  const releasedList = Array.from(krathongMap.values());
  if (releasedList.length > (prev.releasedKrathongs?.length ?? 0)) {
    nextPierCeremony.p1Ready = false;
    nextPierCeremony.p2Ready = false;
  }

  return {
    inventory: nextInventory,
    lotusBoat: nextLotusBoat,
    leafRelay: nextLeafRelay,
    fortunePaper: nextFortunePaper,
    skyLantern: nextSkyLantern,
    activePose: incoming.activePose || prev.activePose || 'sit-moon',
    photoMemories: Array.from(photoMap.values()).slice(-12),
    pierCeremony: nextPierCeremony,
    krathongCrafted: Boolean(prev.krathongCrafted || incoming.krathongCrafted),
    krathongDesign: nextKrathongDesign,
    releasedKrathongs: releasedList,
    questStage:
      releasedList.length > 0
        ? 'released'
        : prev.krathongCrafted || incoming.krathongCrafted
          ? 'ceremony'
          : incoming.questStage || prev.questStage || 'explore',
    lastEventLog:
      typeof incoming.lastEventLog === 'string' && incoming.lastEventLog.trim()
        ? incoming.lastEventLog.slice(0, 220)
        : prev.lastEventLog,
  };
}

/**
 * Masks the partner's unrevealed Fortune Paper answer so neither client can see it
 * before both lock their answers simultaneously.
 */
function sharedStateForRole(shared, role) {
  const fp = shared.fortunePaper;
  if (!fp || fp.revealed) return shared;
  return {
    ...shared,
    fortunePaper: {
      ...fp,
      p1Answer: role === 'p1' ? fp.p1Answer : '',
      p2Answer: role === 'p2' ? fp.p2Answer : '',
    },
  };
}

function sanitizeProfile(raw, role, fallback) {
  const base = fallback || DEFAULT_PLAYERS[role];
  if (!raw || typeof raw !== 'object') return base;
  const cust = raw.customization && typeof raw.customization === 'object' ? raw.customization : {};
  const port = raw.portrait && typeof raw.portrait === 'object' ? raw.portrait : {};
  const pos = raw.position && typeof raw.position === 'object' ? raw.position : {};
  const safeDataUrl =
    typeof port.dataUrl === 'string' &&
    port.dataUrl.startsWith('data:image/') &&
    port.dataUrl.length <= 260_000
      ? port.dataUrl
      : null;

  return {
    id: role,
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, 24)
        : base.name,
    customization: {
      gender:
        cust.gender === 'female' || cust.gender === 'male' || cust.gender === 'nonbinary'
          ? cust.gender
          : base.customization.gender || (role === 'p1' ? 'female' : 'male'),
      skinTone: typeof cust.skinTone === 'string' ? cust.skinTone : base.customization.skinTone,
      hairStyle: typeof cust.hairStyle === 'string' ? cust.hairStyle : base.customization.hairStyle,
      hairColor: typeof cust.hairColor === 'string' ? cust.hairColor : base.customization.hairColor,
      outfit: typeof cust.outfit === 'string' ? cust.outfit : base.customization.outfit,
      accessory:
        cust.accessory === 'gold-lotus' || cust.accessory === 'jasmine-pin'
          ? cust.accessory
          : cust.accessory === 'none'
            ? 'none'
            : base.customization.accessory || 'none',
    },
    portrait: {
      status: safeDataUrl ? 'ready' : 'absent',
      dataUrl: safeDataUrl,
      mimeType: safeDataUrl && typeof port.mimeType === 'string' ? port.mimeType : null,
      error: null,
      updatedAt: safeDataUrl && typeof port.updatedAt === 'string' ? port.updatedAt : null,
    },
    position: {
      x: Number.isFinite(pos.x) ? Math.max(32, Math.min(1408, Number(pos.x))) : base.position.x,
      y: Number.isFinite(pos.y) ? Math.max(56, Math.min(840, Number(pos.y))) : base.position.y,
      facing: ['up', 'down', 'left', 'right'].includes(pos.facing)
        ? pos.facing
        : base.position.facing,
    },
  };
}

function sendJson(ws, payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

export function createRoomHub() {
  /** @type {Map<string, any>} */
  const rooms = new Map();

  function pruneExpiredRooms() {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      const hasOnline = Boolean(room.sockets.p1 || room.sockets.p2);
      if (!hasOnline && now - room.updatedAt > ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
    if (rooms.size > MAX_ROOMS) {
      const oldest = Array.from(rooms.entries())
        .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
        .slice(0, rooms.size - MAX_ROOMS);
      for (const [code] of oldest) {
        rooms.delete(code);
      }
    }
  }

  function createRoomRecord(code) {
    pruneExpiredRooms();
    const room = {
      code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sockets: { p1: null, p2: null },
      seatKeys: { p1: null, p2: null },
      players: {
        p1: structuredClone(DEFAULT_PLAYERS.p1),
        p2: structuredClone(DEFAULT_PLAYERS.p2),
      },
      shared: createDefaultSharedState(),
    };
    rooms.set(code, room);
    return room;
  }

  function getOccupancy(room) {
    return {
      p1: Boolean(room.sockets.p1 && room.sockets.p1.readyState === 1),
      p2: Boolean(room.sockets.p2 && room.sockets.p2.readyState === 1),
    };
  }

  function broadcastRoomSnapshot(room, eventLog) {
    if (eventLog) {
      room.shared.lastEventLog = eventLog;
    }
    room.updatedAt = Date.now();
    const occupancy = getOccupancy(room);
    for (const role of ['p1', 'p2']) {
      sendJson(room.sockets[role], {
        type: 'room_snapshot',
        roomCode: room.code,
        occupancy,
        players: room.players,
        shared: sharedStateForRole(room.shared, role),
      });
    }
  }

  /**
   * HTTP middleware handler for GET /api/invitations/:code
   * Returns true if the request was handled, false otherwise.
   */
  function handleInvitation(req, res) {
    if (!req?.url) return false;
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return false;
    }
    if (!pathname.startsWith('/api/invitations/')) return false;

    const code = pathname.slice('/api/invitations/'.length).toLowerCase();
    const reply = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(body));
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      reply(405, { error: { code: 'method_not_allowed', message: 'Method Not Allowed' } });
      return true;
    }
    if (!ROOM_CODE_RE.test(code)) {
      reply(400, { error: { code: 'invalid_code', message: 'ลิงก์คำเชิญนี้ไม่ถูกต้อง' } });
      return true;
    }

    pruneExpiredRooms();
    const room = rooms.get(code);
    if (!room) {
      reply(404, {
        error: {
          code: 'not_found',
          message: 'ไม่พบห้องลอยกระทงนี้แล้ว หรือคำเชิญหมดอายุแล้ว',
        },
      });
      return true;
    }

    if (room.seatKeys.p2 && room.sockets.p2 && room.sockets.p2.readyState === 1) {
      reply(409, {
        error: {
          code: 'room_full',
          message: 'ห้องนี้มีคู่รักเข้าครบทั้งสองคนแล้ว',
        },
      });
      return true;
    }

    reply(200, {
      roomCode: room.code,
      hostName: room.players.p1.name,
    });
    return true;
  }

  function attachToServer(httpServer) {
    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: MAX_PAYLOAD_BYTES,
    });

    httpServer.on('upgrade', (request, socket, head) => {
      try {
        const reqUrl = new URL(request.url || '/', 'http://localhost');
        if (reqUrl.pathname !== '/ws') {
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
      /** @type {any} */
      let joinedRoom = null;
      /** @type {'p1' | 'p2' | null} */
      let assignedRole = null;

      ws.on('message', (rawBuf) => {
        let msg;
        try {
          msg = JSON.parse(rawBuf.toString('utf8'));
        } catch {
          return;
        }
        if (!msg || typeof msg !== 'object') return;

        // 1. CREATE ROOM (host creates private 24-hex room with 32-hex seatKey)
        if (msg.type === 'create_room') {
          const seatKey =
            typeof msg.seatKey === 'string' && SEAT_KEY_RE.test(msg.seatKey)
              ? msg.seatKey
              : crypto.randomBytes(16).toString('hex');
          let code = crypto.randomBytes(12).toString('hex');
          while (rooms.has(code)) {
            code = crypto.randomBytes(12).toString('hex');
          }
          const room = createRoomRecord(code);
          room.seatKeys.p1 = seatKey;
          room.sockets.p1 = ws;
          if (msg.profile) {
            room.players.p1 = sanitizeProfile(msg.profile, 'p1', room.players.p1);
          }

          joinedRoom = room;
          assignedRole = 'p1';
          room.updatedAt = Date.now();

          sendJson(ws, {
            type: 'joined_room',
            roomCode: room.code,
            role: 'p1',
            occupancy: getOccupancy(room),
            players: room.players,
            shared: sharedStateForRole(room.shared, 'p1'),
          });
          return;
        }

        // 2. RESUME ROOM (reconnect to existing seat using roomCode + seatKey)
        if (msg.type === 'resume_room') {
          const code = typeof msg.roomCode === 'string' ? msg.roomCode.toLowerCase() : '';
          const seatKey = typeof msg.seatKey === 'string' ? msg.seatKey.toLowerCase() : '';
          const room = rooms.get(code);
          if (!room) {
            sendJson(ws, {
              type: 'room_error',
              code: 'not_found',
              message: 'ห้องเดิมหมดอายุแล้ว เริ่มคืนใหม่กันได้เลย',
            });
            return;
          }

          /** @type {'p1' | 'p2' | null} */
          let role = null;
          if (room.seatKeys.p1 === seatKey) role = 'p1';
          else if (room.seatKeys.p2 === seatKey) role = 'p2';

          if (!role) {
            sendJson(ws, {
              type: 'room_error',
              code: 'invalid_seat',
              message: 'ไม่สามารถกลับเข้าที่นั่งเดิมได้ กรุณาเข้าผ่านคำเชิญอีกครั้ง',
            });
            return;
          }

          if (room.sockets[role] && room.sockets[role] !== ws && room.sockets[role].readyState === 1) {
            sendJson(ws, {
              type: 'room_error',
              code: 'seat_busy',
              message: 'กำลังสลับการเชื่อมต่อจากหน้าต่างเดิม…',
            });
            return;
          }

          room.sockets[role] = ws;
          joinedRoom = room;
          assignedRole = role;
          room.updatedAt = Date.now();

          sendJson(ws, {
            type: 'joined_room',
            roomCode: room.code,
            role,
            occupancy: getOccupancy(room),
            players: room.players,
            shared: sharedStateForRole(room.shared, role),
          });
          broadcastRoomSnapshot(
            room,
            `${room.players[role].name} กลับเข้ามาเดินเล่นด้วยกันแล้ว`
          );
          return;
        }

        // 3. JOIN ROOM (invited partner joins an existing room via roomCode + seatKey)
        if (msg.type === 'join_room') {
          const code = typeof msg.roomCode === 'string' ? msg.roomCode.toLowerCase() : '';
          const seatKey =
            typeof msg.seatKey === 'string' && SEAT_KEY_RE.test(msg.seatKey)
              ? msg.seatKey
              : crypto.randomBytes(16).toString('hex');

          if (!ROOM_CODE_RE.test(code)) {
            sendJson(ws, {
              type: 'room_error',
              code: 'invalid_code',
              message: 'ลิงก์คำเชิญนี้ไม่ถูกต้อง',
            });
            return;
          }

          const room = rooms.get(code);
          if (!room) {
            sendJson(ws, {
              type: 'room_error',
              code: 'not_found',
              message: 'ไม่พบห้องลอยกระทงนี้แล้ว หรือคำเชิญหมดอายุแล้ว',
            });
            return;
          }

          /** @type {'p1' | 'p2' | null} */
          let role = null;
          if (room.seatKeys.p1 === seatKey) {
            role = 'p1';
          } else if (room.seatKeys.p2 === seatKey) {
            role = 'p2';
          } else if (!room.seatKeys.p2) {
            role = 'p2';
            room.seatKeys.p2 = seatKey;
          } else if (!room.sockets.p2 || room.sockets.p2.readyState !== 1) {
            role = 'p2';
            room.seatKeys.p2 = seatKey;
          }

          if (!role) {
            sendJson(ws, {
              type: 'room_error',
              code: 'room_full',
              message: 'ห้องนี้มีคู่รักเข้าครบทั้งสองคนแล้ว',
            });
            return;
          }

          if (room.sockets[role] && room.sockets[role] !== ws && room.sockets[role].readyState === 1) {
            sendJson(ws, {
              type: 'room_error',
              code: 'seat_busy',
              message: 'กำลังสลับการเชื่อมต่อจากหน้าต่างเดิม…',
            });
            return;
          }

          room.sockets[role] = ws;
          if (msg.profile) {
            room.players[role] = sanitizeProfile(msg.profile, role, room.players[role]);
          }

          joinedRoom = room;
          assignedRole = role;
          room.updatedAt = Date.now();

          sendJson(ws, {
            type: 'joined_room',
            roomCode: room.code,
            role,
            occupancy: getOccupancy(room),
            players: room.players,
            shared: sharedStateForRole(room.shared, role),
          });

          const bothHere = getOccupancy(room).p1 && getOccupancy(room).p2;
          broadcastRoomSnapshot(
            room,
            bothHere
              ? `${room.players.p1.name} และ ${room.players.p2.name} อยู่ด้วยกันใต้แสงจันทร์แล้ว`
              : `${room.players[role].name} เข้าสู่ห้องคืนเพ็ญแล้ว`
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
          joinedRoom.shared = mergeSharedState(joinedRoom.shared, msg.shared, {
            forceReplace: Boolean(msg.forceReplace),
            senderRole: assignedRole,
          });
          broadcastRoomSnapshot(joinedRoom);
          return;
        }

        if (msg.type === 'coop_signal' && typeof msg.spotId === 'string') {
          const payload = {
            type: 'coop_signal',
            playerId: assignedRole,
            spotId: msg.spotId.slice(0, 48),
            action:
              typeof msg.action === 'string' ? msg.action.slice(0, 48) : 'pulse',
            value:
              typeof msg.value === 'number' && Number.isFinite(msg.value)
                ? msg.value
                : 0,
            x:
              typeof msg.x === 'number' && Number.isFinite(msg.x)
                ? msg.x
                : undefined,
            y:
              typeof msg.y === 'number' && Number.isFinite(msg.y)
                ? msg.y
                : undefined,
            ts: Date.now(),
          };
          sendJson(joinedRoom.sockets.p1, payload);
          sendJson(joinedRoom.sockets.p2, payload);
          return;
        }

        if (msg.type === 'photobooth_frame') {
          const dataUrl =
            typeof msg.dataUrl === 'string' &&
            msg.dataUrl.startsWith('data:image/') &&
            msg.dataUrl.length <= 120_000
              ? msg.dataUrl
              : null;
          if (!dataUrl) return;
          const partnerRole = assignedRole === 'p1' ? 'p2' : 'p1';
          sendJson(joinedRoom.sockets[partnerRole], {
            type: 'photobooth_frame',
            playerId: assignedRole,
            dataUrl,
            mirrored: msg.mirrored !== false,
            filter: typeof msg.filter === 'string' ? msg.filter.slice(0, 24) : 'natural',
            ts: Date.now(),
          });
          return;
        }

        if (msg.type === 'photobooth_cam_state') {
          const partnerRole = assignedRole === 'p1' ? 'p2' : 'p1';
          sendJson(joinedRoom.sockets[partnerRole], {
            type: 'photobooth_cam_state',
            playerId: assignedRole,
            active: Boolean(msg.active),
            ts: Date.now(),
          });
          return;
        }

        if (msg.type === 'photobooth_shutter') {
          const payload = {
            type: 'photobooth_shutter',
            playerId: assignedRole,
            sessionId:
              typeof msg.sessionId === 'string'
                ? msg.sessionId.slice(0, 64)
                : `pb-${Date.now()}`,
            layout: msg.layout === 'strip-4' ? 'strip-4' : 'polaroid',
            backdrop:
              typeof msg.backdrop === 'string' ? msg.backdrop.slice(0, 24) : 'sala',
            pose: typeof msg.pose === 'string' ? msg.pose.slice(0, 24) : 'heart-hands',
            caption:
              typeof msg.caption === 'string' ? msg.caption.slice(0, 96) : '',
            ts: Date.now(),
          };
          sendJson(joinedRoom.sockets.p1, payload);
          sendJson(joinedRoom.sockets.p2, payload);
          return;
        }

        if (msg.type === 'photobooth_snap') {
          const safeDataUrl =
            typeof msg.dataUrl === 'string' &&
            msg.dataUrl.startsWith('data:image/') &&
            msg.dataUrl.length <= 280_000
              ? msg.dataUrl
              : null;
          const payload = {
            type: 'photobooth_snap',
            playerId: assignedRole,
            sessionId:
              typeof msg.sessionId === 'string' ? msg.sessionId.slice(0, 64) : '',
            shotIndex:
              typeof msg.shotIndex === 'number' && Number.isInteger(msg.shotIndex)
                ? Math.max(0, Math.min(3, msg.shotIndex))
                : 0,
            dataUrl: safeDataUrl,
            ts: Date.now(),
          };
          sendJson(joinedRoom.sockets.p1, payload);
          sendJson(joinedRoom.sockets.p2, payload);
          return;
        }

        if (msg.type === 'send_emote') {
          const emoji =
            typeof msg.emoji === 'string' ? msg.emoji.slice(0, 8) : '💖';
          const text =
            typeof msg.text === 'string'
              ? msg.text.slice(0, 48)
              : 'ส่งหัวใจให้แฟน';
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
            `${leftName} พักการเชื่อมต่อชั่วคราว (เปิดลิงก์เดิมเพื่อกลับมาเดินต่อได้ทันที)`
          );
        }
      });
    });

    return wss;
  }

  return {
    attachToServer,
    handleInvitation,
    rooms,
  };
}
