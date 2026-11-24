import Phaser from 'phaser';
import type { Direction, GameState, PlayerId } from '../domain/types';
import {
  PIER_WALKABLE_RECT,
  RIVER_BANK_Y,
  SOLID_OBSTACLES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WORLD_SPOTS,
} from '../domain/worldMap';
import {
  drawCharacterToGraphics,
  drawKrathongGraphic,
  ensureFestivalTextures,
  syncLocalPortraitTexture,
} from './textures';

export interface SceneBridgeCallbacks {
  onMove: (playerId: PlayerId, dx: number, dy: number, facing: Direction) => void;
  onInteractSpot: (spotId: string) => void;
}

interface LanternVisual {
  id: string;
  glow: Phaser.GameObjects.Image;
  bulb: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
}

interface KrathongVisual {
  id: string;
  container: Phaser.GameObjects.Container;
  baseX: number;
  baseY: number;
}

export class FestivalScene extends Phaser.Scene {
  private callbacks: SceneBridgeCallbacks;
  private snapshot: GameState;
  private reducedMotion = false;

  private playerContainers!: Record<PlayerId, Phaser.GameObjects.Container>;
  private playerGraphics!: Record<PlayerId, Phaser.GameObjects.Graphics>;
  private playerNames!: Record<PlayerId, Phaser.GameObjects.Text>;
  private playerPortraitBadges!: Record<PlayerId, Phaser.GameObjects.Image | null>;
  private loadedPortraitKeys: Record<PlayerId, string | null> = { p1: null, p2: null };

  private lanternVisuals: LanternVisual[] = [];
  private krathongVisuals: Map<string, KrathongVisual> = new Map();
  private fireflies: { sprite: Phaser.GameObjects.Image; ox: number; oy: number; phase: number }[] = [];
  private moonShimmer!: Phaser.GameObjects.Graphics;
  private nearbyHalo!: Phaser.GameObjects.Arc;
  private craftPreviewKrathong!: Phaser.GameObjects.Graphics;

  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private arrowKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private modalBlocked = false;
  private touchVector = { x: 0, y: 0 };
  private interactQueued = false;

  constructor(
    initialState: GameState,
    callbacks: SceneBridgeCallbacks,
    initialReducedMotion = false
  ) {
    super({ key: 'FestivalScene' });
    this.snapshot = initialState;
    this.callbacks = callbacks;
    this.reducedMotion = initialReducedMotion;
  }

  public setTouchVector(vx: number, vy: number): void {
    this.touchVector.x = vx;
    this.touchVector.y = vy;
  }

  public setModalBlocked(blocked: boolean): void {
    this.modalBlocked = blocked;
    if (blocked) {
      this.touchVector.x = 0;
      this.touchVector.y = 0;
      this.interactQueued = false;
    }
    if (this.input?.keyboard) {
      this.input.keyboard.enabled = !blocked;
      if (blocked) {
        this.input.keyboard.clearCaptures();
        this.input.keyboard.resetKeys();
      }
    }
  }

  public updateSnapshot(state: GameState, reducedMotion: boolean): void {
    this.snapshot = state;
    this.reducedMotion = reducedMotion;
    if (!this.scene || !this.sys.isActive()) return;
    this.refreshVisualState();
  }

  public create(): void {
    ensureFestivalTextures(this);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor('#091026');

    this.drawWorldEnvironment();
    this.createZonesAndSpots();
    this.createPlayers();

    if (this.input.keyboard) {
      // Avoid createCursorKeys() because it globally captures Space/Shift via preventDefault(),
      // which blocks native <button> Spacebar activation inside modal minigames.
      this.input.keyboard.clearCaptures();
      this.arrowKeys = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
      };
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
      };
      this.input.keyboard.enabled = !this.modalBlocked;

      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        if (this.isDomInputFocused()) return;
        if (
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight'
        ) {
          event.preventDefault();
        } else if (event.key === 'e' || event.key === 'E') {
          this.interactQueued = true;
        }
      });
    }

    this.refreshVisualState();
  }

  private isDomInputFocused(): boolean {
    if (this.modalBlocked || Boolean(document.querySelector('dialog[open]'))) {
      return true;
    }
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      active.getAttribute('contenteditable') === 'true'
    );
  }

  private drawWorldEnvironment(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x10222b, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, RIVER_BANK_Y);
    bg.fillStyle(0x0b132b, 1);
    bg.fillRect(0, 0, WORLD_WIDTH, 54);

    bg.fillStyle(0x28273e, 0.95);
    bg.fillRoundedRect(170, 175, 1110, 90, 26);
    bg.fillRoundedRect(200, 445, 590, 105, 28);
    bg.fillRoundedRect(710, 210, 110, 498, 22);
    bg.fillRoundedRect(780, 560, 210, 150, 22);

    bg.lineStyle(2, 0xfbbf24, 0.25);
    bg.strokeRoundedRect(170, 175, 1110, 90, 26);
    bg.strokeRoundedRect(200, 445, 590, 105, 28);

    bg.fillStyle(0x081534, 1);
    bg.fillRect(0, RIVER_BANK_Y, WORLD_WIDTH, WORLD_HEIGHT - RIVER_BANK_Y);
    bg.fillStyle(0x0d214f, 0.55);
    bg.fillRect(0, RIVER_BANK_Y + 26, WORLD_WIDTH, 160);

    this.moonShimmer = this.add.graphics();
    this.drawMoonShimmer(0);

    bg.fillStyle(0x3b354f, 1);
    bg.fillRect(0, RIVER_BANK_Y - 12, WORLD_WIDTH, 16);
    bg.fillStyle(0xf59e0b, 0.22);
    bg.fillRect(0, RIVER_BANK_Y - 12, WORLD_WIDTH, 3);

    const pier = PIER_WALKABLE_RECT;
    bg.fillStyle(0x6b4226, 1);
    bg.fillRoundedRect(pier.x, pier.y, pier.w, pier.h, 8);
    bg.lineStyle(3, 0xd97706, 0.8);
    bg.strokeRoundedRect(pier.x, pier.y, pier.w, pier.h, 8);
    for (let py = pier.y + 14; py < pier.y + pier.h; py += 16) {
      bg.lineStyle(1.5, 0x3e2514, 0.8);
      bg.lineBetween(pier.x + 4, py, pier.x + pier.w - 4, py);
    }

    for (const obs of SOLID_OBSTACLES) {
      if (obs.label.includes('สระบัว')) {
        bg.fillStyle(0x0f3b57, 1);
        bg.fillRoundedRect(obs.x, obs.y, obs.w, obs.h, 24);
        bg.lineStyle(3, 0x2dd4bf, 0.45);
        bg.strokeRoundedRect(obs.x, obs.y, obs.w, obs.h, 24);
        bg.fillStyle(0x15803d, 0.9);
        bg.fillCircle(obs.x + 36, obs.y + 34, 14);
        bg.fillCircle(obs.x + 88, obs.y + 42, 16);
        bg.fillStyle(0xf472b6, 1);
        bg.fillCircle(obs.x + 36, obs.y + 34, 6);
        bg.fillCircle(obs.x + 88, obs.y + 42, 7);
      } else if (obs.label.includes('ร้าน')) {
        const isBua = obs.label.includes('ป้าบัว');
        bg.fillStyle(0x4a2c1d, 1);
        bg.fillRoundedRect(obs.x, obs.y, obs.w, obs.h, 10);
        bg.fillStyle(isBua ? 0xdb2777 : 0xd97706, 0.95);
        bg.fillRoundedRect(obs.x - 6, obs.y - 6, obs.w + 12, 34, 8);
        bg.fillStyle(0xfef3c7, 0.85);
        for (let sx = obs.x + 8; sx < obs.x + obs.w - 8; sx += 26) {
          bg.fillRect(sx, obs.y - 6, 12, 32);
        }
      } else if (obs.label.includes('ศาลา')) {
        bg.fillStyle(0x5b3422, 1);
        bg.fillRoundedRect(obs.x, obs.y, obs.w, obs.h, 12);
        bg.lineStyle(3, 0xfbbf24, 0.75);
        bg.strokeRoundedRect(obs.x, obs.y, obs.w, obs.h, 12);
        bg.fillStyle(0x3f2419, 0.75);
        bg.fillRoundedRect(obs.x + 6, obs.y + obs.h, obs.w - 12, 82, 10);
      } else if (obs.label.includes('โต๊ะ')) {
        bg.fillStyle(0x6d3e24, 1);
        bg.fillRoundedRect(obs.x, obs.y, obs.w, obs.h, 10);
        bg.lineStyle(2.5, 0xfbbf24, 0.75);
        bg.strokeRoundedRect(obs.x, obs.y, obs.w, obs.h, 10);
      } else if (obs.label.includes('ต้น')) {
        bg.fillStyle(0x14532d, 1);
        bg.fillCircle(obs.x + obs.w / 2, obs.y + obs.h / 2, 34);
        bg.fillStyle(0x22c55e, 0.35);
        bg.fillCircle(obs.x + obs.w / 2 - 8, obs.y + obs.h / 2 - 8, 22);
      } else {
        bg.fillStyle(0x854d0e, 1);
        bg.fillRoundedRect(obs.x, obs.y, obs.w, obs.h, 8);
      }
    }

    bg.fillStyle(0xa16207, 1);
    bg.fillRoundedRect(164, 114, 188, 18, 8);
    bg.lineStyle(2, 0xfde68a, 0.6);
    bg.strokeRoundedRect(164, 114, 188, 18, 8);

    const fireflyCoords = [
      { ox: 180, oy: 470, phase: 0 },
      { ox: 280, oy: 560, phase: 1.3 },
      { ox: 360, oy: 490, phase: 2.6 },
      { ox: 440, oy: 610, phase: 3.9 },
      { ox: 560, oy: 575, phase: 5.1 },
      { ox: 1120, oy: 560, phase: 2.1 },
    ];
    for (const f of fireflyCoords) {
      const sprite = this.add.image(f.ox, f.oy, 'firefly-dot');
      sprite.setScale(1.1);
      this.fireflies.push({ sprite, ...f });
    }
  }

  private drawMoonShimmer(t: number): void {
    this.moonShimmer.clear();
    this.moonShimmer.fillStyle(0xfef08a, 0.14);
    this.moonShimmer.fillEllipse(1160, 810, 140, 210);
    for (let row = 0; row < 6; row += 1) {
      const y = 738 + row * 34;
      const sway = this.reducedMotion ? 0 : Math.sin(t * 0.0018 + row) * 14;
      const w = 96 - row * 10;
      this.moonShimmer.fillStyle(0xfef08a, 0.28 - row * 0.03);
      this.moonShimmer.fillRoundedRect(1160 - w / 2 + sway, y, w, 6, 3);
    }
  }

  private createZonesAndSpots(): void {
    this.nearbyHalo = this.add.circle(0, 0, 38, 0xfbbf24, 0.22);
    this.nearbyHalo.setStrokeStyle(2.5, 0xfde68a, 0.9);
    this.nearbyHalo.setVisible(false);

    this.craftPreviewKrathong = this.add.graphics({ x: 760, y: 416 });

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Noto Sans Thai", "Leelawadee UI", system-ui, sans-serif',
      fontSize: '13px',
      color: '#F8FAFC',
      backgroundColor: 'rgba(10, 15, 36, 0.85)',
      padding: { x: 8, y: 4 },
    };

    for (const spot of WORLD_SPOTS) {
      if (spot.kind === 'lantern') {
        const glow = this.add.image(spot.x, spot.y - 24, 'festival-glow').setScale(0.5);
        const bulb = this.add.circle(spot.x, spot.y - 24, 12, 0x92400e);
        bulb.setStrokeStyle(2, 0xfde68a, 0.8);
        const ring = this.add.circle(spot.x, spot.y, 20, 0xf59e0b, 0.16);
        ring.setStrokeStyle(1.5, 0xfde68a, 0.6);
        this.lanternVisuals.push({ id: spot.id, glow, bulb, ring });
      } else if (spot.kind === 'npc') {
        const isBua = spot.id === 'npc-bua';
        this.add.image(spot.x, spot.y - 28, isBua ? 'pink-glow' : 'festival-glow').setScale(0.75);
        const npcG = this.add.graphics({ x: spot.x, y: spot.y - 24 });
        npcG.fillStyle(isBua ? 0xec4899 : 0x0ea5e9, 1);
        npcG.fillRoundedRect(-11, -4, 22, 16, 6);
        npcG.fillStyle(0xdfa579, 1);
        npcG.fillCircle(0, -13, 10);
        npcG.fillStyle(isBua ? 0x1e293b : 0xe2e8f0, 1);
        npcG.fillEllipse(0, -20, 20, 9);
      } else if (spot.kind === 'gather') {
        this.add.image(spot.x, spot.y, 'pink-glow').setScale(0.8);
        const ring = this.add.circle(spot.x, spot.y, 24, 0xf472b6, 0.25);
        ring.setStrokeStyle(2, 0xf9a8d4, 0.85);
      } else if (spot.kind === 'pavilion') {
        this.add.image(spot.x, spot.y - 20, 'pink-glow').setScale(0.95);
        const ring = this.add.circle(spot.x, spot.y, 22, 0xf472b6, 0.22);
        ring.setStrokeStyle(2, 0xfde68a, 0.8);
      } else if (spot.kind === 'craft') {
        this.add.image(spot.x, spot.y - 34, 'festival-glow').setScale(0.95);
        const ring = this.add.circle(spot.x, spot.y, 24, 0xf59e0b, 0.22);
        ring.setStrokeStyle(2, 0xfde68a, 0.9);
      } else if (spot.kind === 'pier') {
        this.add.image(spot.x, spot.y + 8, 'festival-glow').setScale(1.0);
        const ring = this.add.circle(spot.x, spot.y, 26, 0x2dd4bf, 0.22);
        ring.setStrokeStyle(2, 0x99f6e4, 0.9);
      }

      const txt = this.add.text(spot.x, spot.y + 34, spot.title, labelStyle);
      txt.setOrigin(0.5, 0);
      txt.setInteractive({ useHandCursor: true });
      txt.on('pointerup', () => {
        const active = this.snapshot.players[this.snapshot.settings.activePlayer];
        const dist = Phaser.Math.Distance.Between(
          active.position.x,
          active.position.y,
          spot.x,
          spot.y
        );
        if (dist <= spot.radius + 16) {
          this.callbacks.onInteractSpot(spot.id);
        }
      });
    }
  }

  private createPlayers(): void {
    const createOne = (pid: PlayerId) => {
      const profile = this.snapshot.players[pid];
      const container = this.add.container(profile.position.x, profile.position.y);
      const gfx = this.add.graphics();
      const nameTxt = this.add
        .text(0, -36, profile.name, {
          fontFamily: '"Noto Sans Thai", "Leelawadee UI", system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#FFFFFF',
          backgroundColor: pid === 'p1' ? 'rgba(13, 148, 136, 0.9)' : 'rgba(219, 39, 119, 0.9)',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(0.5, 1);

      container.add([gfx, nameTxt]);
      container.setDepth(20);
      return { container, gfx, nameTxt };
    };

    const p1 = createOne('p1');
    const p2 = createOne('p2');
    this.playerContainers = { p1: p1.container, p2: p2.container };
    this.playerGraphics = { p1: p1.gfx, p2: p2.gfx };
    this.playerNames = { p1: p1.nameTxt, p2: p2.nameTxt };
    this.playerPortraitBadges = { p1: null, p2: null };
  }

  private refreshVisualState(): void {
    const activeId = this.snapshot.settings.activePlayer;

    for (const pid of ['p1', 'p2'] as const) {
      const profile = this.snapshot.players[pid];
      const container = this.playerContainers[pid];
      container.setPosition(profile.position.x, profile.position.y);
      container.setDepth(pid === activeId ? 25 : 22);

      drawCharacterToGraphics(this.playerGraphics[pid], profile, pid === activeId);
      this.playerNames[pid].setText(profile.name || (pid === 'p1' ? 'ผู้เล่น 1' : 'ผู้เล่น 2'));

      const wantKey =
        profile.portrait.status === 'ready' && profile.portrait.dataUrl
          ? `portrait-${pid}-${profile.portrait.updatedAt ?? 'local'}`
          : null;

      if (this.loadedPortraitKeys[pid] !== wantKey) {
        this.loadedPortraitKeys[pid] = wantKey;
        if (this.playerPortraitBadges[pid]) {
          this.playerPortraitBadges[pid]?.destroy();
          this.playerPortraitBadges[pid] = null;
        }
        if (wantKey && profile.portrait.dataUrl) {
          syncLocalPortraitTexture(this, wantKey, profile.portrait.dataUrl, (readyKey) => {
            if (!readyKey || !this.sys.isActive() || this.loadedPortraitKeys[pid] !== wantKey) {
              return;
            }
            const img = this.add.image(0, -15, readyKey).setDisplaySize(26, 26);
            this.playerContainers[pid].add(img);
            this.playerPortraitBadges[pid] = img;
          });
        }
      }
    }

    const activeContainer = this.playerContainers[activeId];
    if (activeContainer) {
      this.cameras.main.startFollow(
        activeContainer,
        true,
        this.reducedMotion ? 1 : 0.14,
        this.reducedMotion ? 1 : 0.14
      );
    }

    for (const lv of this.lanternVisuals) {
      const lit = this.snapshot.litLanternIds.includes(lv.id);
      lv.bulb.setFillStyle(lit ? 0xfbbf24 : 0x78350f);
      lv.glow.setScale(lit ? 1.15 : 0.45);
      lv.glow.setAlpha(lit ? 0.95 : 0.25);
      lv.ring.setStrokeStyle(lit ? 2.5 : 1.5, lit ? 0xfef08a : 0xfde68a, lit ? 0.95 : 0.45);
    }

    this.craftPreviewKrathong.setVisible(this.snapshot.krathongCrafted);
    if (this.snapshot.krathongCrafted) {
      drawKrathongGraphic(this.craftPreviewKrathong, this.snapshot.krathongDesign, 'radiant');
    }

    const nearbySpot = WORLD_SPOTS.find((s) => s.id === this.snapshot.nearbySpotId);
    if (nearbySpot) {
      this.nearbyHalo.setPosition(nearbySpot.x, nearbySpot.y);
      this.nearbyHalo.setVisible(true);
    } else {
      this.nearbyHalo.setVisible(false);
    }

    const existingIds = new Set(this.snapshot.releasedKrathongs.map((k) => k.id));
    for (const [id, visual] of this.krathongVisuals.entries()) {
      if (!existingIds.has(id)) {
        visual.container.destroy();
        this.krathongVisuals.delete(id);
      }
    }

    for (const item of this.snapshot.releasedKrathongs) {
      if (!this.krathongVisuals.has(item.id)) {
        const container = this.add.container(item.x, item.y);
        const glowImg = this.add
          .image(0, 0, 'festival-glow')
          .setScale(item.quality.tier === 'celestial' ? 1.35 : 0.95);
        const gfx = this.add.graphics();
        drawKrathongGraphic(gfx, item.design, item.quality.tier);
        const tag = this.add
          .text(0, 22, `${item.coupleNames[0]} & ${item.coupleNames[1]}`, {
            fontFamily: '"Noto Sans Thai", "Leelawadee UI", system-ui, sans-serif',
            fontSize: '11px',
            color: '#FEF3C7',
            backgroundColor: 'rgba(10, 15, 36, 0.78)',
            padding: { x: 6, y: 2 },
          })
          .setOrigin(0.5, 0);
        container.add([glowImg, gfx, tag]);
        container.setDepth(15);
        this.krathongVisuals.set(item.id, {
          id: item.id,
          container,
          baseX: item.x,
          baseY: item.y,
        });
      }
    }
  }

  public update(time: number, delta: number): void {
    const dtFactor = Math.min(delta, 40) / 16.667;
    const speed = 3.2 * dtFactor;

    if (!this.isDomInputFocused()) {
      let p1dx = 0;
      let p1dy = 0;
      if (this.wasdKeys?.A.isDown) p1dx -= 1;
      if (this.wasdKeys?.D.isDown) p1dx += 1;
      if (this.wasdKeys?.W.isDown) p1dy -= 1;
      if (this.wasdKeys?.S.isDown) p1dy += 1;

      let p2dx = 0;
      let p2dy = 0;
      if (this.arrowKeys?.left.isDown) p2dx -= 1;
      if (this.arrowKeys?.right.isDown) p2dx += 1;
      if (this.arrowKeys?.up.isDown) p2dy -= 1;
      if (this.arrowKeys?.down.isDown) p2dy += 1;

      const activeId = this.snapshot.settings.activePlayer;
      if (Math.hypot(this.touchVector.x, this.touchVector.y) > 0.08) {
        if (activeId === 'p1') {
          p1dx += this.touchVector.x;
          p1dy += this.touchVector.y;
        } else {
          p2dx += this.touchVector.x;
          p2dy += this.touchVector.y;
        }
      }

      if (p1dx !== 0 || p1dy !== 0) {
        const len = Math.hypot(p1dx, p1dy);
        const scale = len > 1 ? 1 / len : 1;
        const dx = p1dx * scale * speed;
        const dy = p1dy * scale * speed;
        const facing: Direction =
          Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
        this.callbacks.onMove('p1', dx, dy, facing);
      }

      if (p2dx !== 0 || p2dy !== 0) {
        const len = Math.hypot(p2dx, p2dy);
        const scale = len > 1 ? 1 / len : 1;
        const dx = p2dx * scale * speed;
        const dy = p2dy * scale * speed;
        const facing: Direction =
          Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
        this.callbacks.onMove('p2', dx, dy, facing);
      }

      if (this.interactQueued) {
        this.interactQueued = false;
        if (this.snapshot.nearbySpotId) {
          this.callbacks.onInteractSpot(this.snapshot.nearbySpotId);
        }
      }
    }

    if (!this.reducedMotion) {
      this.drawMoonShimmer(time);
      for (const f of this.fireflies) {
        f.sprite.setPosition(
          f.ox + Math.sin(time * 0.0014 + f.phase) * 16,
          f.oy + Math.cos(time * 0.0019 + f.phase) * 10
        );
        f.sprite.setAlpha(0.45 + 0.45 * Math.sin(time * 0.003 + f.phase));
      }
      let idx = 0;
      for (const kv of this.krathongVisuals.values()) {
        const drift = (time * 0.015 + idx * 60) % 360;
        kv.container.setPosition(
          kv.baseX + drift,
          kv.baseY + Math.sin(time * 0.002 + idx) * 4
        );
        idx += 1;
      }
    } else {
      for (const f of this.fireflies) {
        f.sprite.setPosition(f.ox, f.oy);
        f.sprite.setAlpha(0.7);
      }
      for (const kv of this.krathongVisuals.values()) {
        kv.container.setPosition(kv.baseX, kv.baseY);
      }
    }
  }
}