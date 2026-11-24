import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useReducer } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InteractionModal } from '../src/components/InteractionModal';
import { ScenicPhotoActivity } from '../src/components/activities/ScenicPhotoActivity';
import * as photoBoothCanvas from '../src/components/activities/photoBoothCanvas';
import { createInitialGameState, gameReducer } from '../src/domain/reducer';
import { applyActivitySkill, type ActivitySkillCommand } from '../src/domain/activitySkills.mjs';
import type { GameAction, GameState, PhotoBoothEvent, PlayerId } from '../src/domain/types';

function ActivityHarness({
  spotId,
  bothOnline = false,
  actor = 'p1',
  lastPhotoEvent = null,
}: {
  spotId: string;
  bothOnline?: boolean;
  actor?: PlayerId;
  lastPhotoEvent?: PhotoBoothEvent | null;
}) {
  const [state, dispatch] = useReducer((current: GameState, action: GameAction | { type: 'TEST_SKILL'; command: ActivitySkillCommand }) =>
    action.type === 'TEST_SKILL' ? applyActivitySkill(current, actor, action.command, Date.now()) : gameReducer(current, action),
    undefined, () => gameReducer(createInitialGameState(), { type: 'ENTER_WORLD' }));

  return (
    <InteractionModal
      spotId={spotId}
      state={state}
      myOnlineRole={actor}
      bothOnline={bothOnline}
      lastPhotoEvent={lastPhotoEvent}
      reducedMotion={true}
      onClose={() => {}}
      onActivitySkill={(command) => dispatch({ type: 'TEST_SKILL', command })}
      onSetFortunePrompt={(promptIndex) =>
        dispatch({ type: 'SET_FORTUNE_PROMPT', promptIndex })
      }
      onSetFortuneAnswer={(playerId, answer) =>
        dispatch({ type: 'SET_FORTUNE_ANSWER', playerId, answer })
      }
      onLockFortuneAnswer={(playerId) =>
        dispatch({ type: 'LOCK_FORTUNE_ANSWER', playerId })
      }
      onResetFortuneRound={() => dispatch({ type: 'RESET_FORTUNE_ROUND' })}
      onSetLanternWish={(playerId, wish) =>
        dispatch({ type: 'SET_LANTERN_WISH', playerId, wish })
      }
      onUpdateKrathongDesign={(patch) =>
        dispatch({ type: 'UPDATE_KRATHONG_DESIGN', patch })
      }
      onAddKrathongDecoration={(item) =>
        dispatch({ type: 'ADD_KRATHONG_DECORATION', item })
      }
      onMoveKrathongDecoration={(id, x, y) =>
        dispatch({ type: 'MOVE_KRATHONG_DECORATION', id, x, y })
      }
      onRemoveKrathongDecoration={(id) =>
        dispatch({ type: 'REMOVE_KRATHONG_DECORATION', id })
      }
      onClearKrathongDecorations={() =>
        dispatch({ type: 'CLEAR_KRATHONG_DECORATIONS' })
      }
      onCraftKrathong={(byPlayer) =>
        dispatch({ type: 'CRAFT_KRATHONG', byPlayer })
      }
      onSetCouplePose={(pose) => dispatch({ type: 'SET_COUPLE_POSE', pose })}
      onSavePhotoMemory={(pose, backdrop, caption, layout, compositeDataUrl, frameTheme) =>
        dispatch({
          type: 'SAVE_PHOTO_MEMORY',
          pose,
          backdrop,
          caption,
          layout,
          compositeDataUrl,
          frameTheme,
        })
      }
      onTogglePierReady={(playerId, ready) =>
        dispatch({ type: 'TOGGLE_PIER_READY', playerId, ready })
      }
      onReleaseKrathong={(byPlayer) =>
        dispatch({
          type: 'RELEASE_KRATHONG',
          byPlayer,
          timestamp: '2026-11-24T13:00:00.000Z',
        })
      }
      onStartAnother={() => dispatch({ type: 'START_ANOTHER_KRATHONG' })}
    />
  );
}

describe('Redesigned Romantic Co-op Activities UI (01–08)', () => {
  it('01 and 02 keep cooperation by role and reject repeated activation of one trace point', () => {
    const boat = render(<ActivityHarness spotId="gather-lotus" bothOnline />);
    expect(screen.getByText('คนพายเรือ:')).toBeInTheDocument();
    expect(screen.getByText('คนเก็บดอกบัว:')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ส่งไม้พายให้อีกคน' }));
    expect(screen.getByText('รอเรือเข้าใกล้ดอกบัว')).toBeInTheDocument();
    expect(screen.queryByText(/วินาที/)).toBeNull();
    boat.unmount();

    const leaf = render(<ActivityHarness spotId="npc-bua" bothOnline />);
    const firstPoint = screen.getByRole('button', { name: 'จุด 1 ของรอยเจียนที่ 1' });
    fireEvent.click(firstPoint);
    fireEvent.click(firstPoint);
    fireEvent.click(firstPoint);
    expect(screen.getByText('เจียนใบตอง · แนว 1/3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'จุด 2 ของรอยเจียนที่ 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'จุด 3 ของรอยเจียนที่ 1' }));
    for (const step of [2, 3]) {
      for (const point of [1, 2, 3]) {
        fireEvent.click(screen.getByRole('button', { name: 'จุด ' + point + ' ของรอยเจียนที่ ' + step }));
      }
    }
    expect(screen.getByRole('button', { name: 'จุด 1 ของรอยพับที่ 1' })).toBeDisabled();
    leaf.rerender(<ActivityHarness spotId="npc-bua" bothOnline actor="p2" />);
    expect(screen.getByRole('button', { name: 'จุด 1 ของรอยพับที่ 1' })).toBeEnabled();
    for (const step of [1, 2, 3]) {
      for (const point of [1, 2, 3]) {
        fireEvent.click(screen.getByRole('button', { name: 'จุด ' + point + ' ของรอยพับที่ ' + step }));
      }
    }
    expect(screen.getByText('กลีบหงส์อ่อนช้อย').closest('.petal-badge')).toHaveClass('is-done');
  });

  it('03: hides each partner answer in Blind Fortune Paper until both seal, then reveals simultaneously and gifts candles', () => {
    render(<ActivityHarness spotId="npc-man" />);

    fireEvent.change(screen.getByLabelText(/คำตอบในใจของคุณ/i), {
      target: { value: 'ไปดูหิ่งห้อยที่อัมพวา' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ปิดผนึกคำตอบของฉัน/i }));
    expect(screen.getByText(/ปิดผนึกคำตอบของคุณไว้เรียบร้อยแล้ว/i)).toBeInTheDocument();
    expect(screen.queryByText(/ไปดูหิ่งห้อยที่อัมพวา/)).toBeNull();

    // Switch to P2, seal answer -> BOTH reveal simultaneously
    fireEvent.click(screen.getByRole('button', { name: /ฝั่ง ต้นกล้า/i }));
    fireEvent.change(screen.getByLabelText(/คำตอบในใจของคุณ/i), {
      target: { value: 'ไปเที่ยวทะเลด้วยกัน' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ปิดผนึกคำตอบของฉัน/i }));

    expect(screen.getByText(/ไปดูหิ่งห้อยที่อัมพวา/)).toBeInTheDocument();
    expect(screen.getByText(/ไปเที่ยวทะเลด้วยกัน/)).toBeInTheDocument();
    expect(screen.getByText(/ชุดธูปเทียนมงคล/)).toBeInTheDocument();
  });

  it('04, 06, 07, 08: allows meaningful sky lantern, shared krathong studio with keyboard nudging, online couple photo booth, and score-free keepsake card', async () => {
    const r4 = render(<ActivityHarness spotId="lantern-sky" bothOnline />);
    fireEvent.change(screen.getByLabelText(/คำอธิษฐานของ ฟ้าใส/i), {
      target: { value: 'ขอให้จับมือกันตลอดไป' },
    });
    const hold = screen.getByRole('button', { name: 'กดค้างเพื่อประคองไฟ' });
    expect(hold).toBeDisabled();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '50' } });
    expect(hold).toBeEnabled();
    fireEvent.click(hold);
    expect(hold).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(hold, { key: ' ' });
    expect(hold).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyUp(hold, { key: ' ' });
    expect(hold).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'เตรียมปล่อยโคมพร้อมกัน' })).toBeNull();
    r4.unmount();

    // 06: Shared Krathong Studio (immediate access, no prerequisites, keyboard nudging)
    const r6 = render(<ActivityHarness spotId="craft-bench" />);
    fireEvent.click(screen.getByRole('button', { name: /หัวใจคู่รัก/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ วางหัวใจคู่รักลงบนกระทง/i }));
    const stickerBtn = screen.getByRole('button', { name: /หัวใจคู่รัก วางโดย ฟ้าใส/i });
    fireEvent.keyDown(stickerBtn, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: /บันทึกกระทงใบเดียวในโลกของเรา/i }));
    expect(screen.getByText(/บันทึกกระทงของเราแล้ว/i)).toBeInTheDocument();
    r6.unmount();

    // 07: jsdom cannot render the WebGL portrait or PNG. Check the shutter's composition request.
    const compose = vi.spyOn(photoBoothCanvas, 'renderCouplePhotoBoothComposite').mockResolvedValue({
      png: new Blob(['fixture'], { type: 'image/png' }),
      compactJpegDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
    });
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL() { return 'blob:strip-test'; }
      static revokeObjectURL() {}
    });
    vi.useFakeTimers();
    try {
      const r7 = render(
        <ActivityHarness
          spotId="pavilion-blessing"
          lastPhotoEvent={{
            type: 'photobooth_frame',
            playerId: 'p2',
            dataUrl:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            mirrored: true,
            filter: 'warm-candle',
            ts: Date.now(),
          }}
        />
      );
      expect(
        screen.getByRole('button', { name: /เปิดกล้องของฉัน/i })
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(/ภาพกล้องสดของ ต้นกล้า/i)
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /กอดอุ่น/i }));
      fireEvent.click(screen.getByRole('button', { name: 'โฟโต้บูธ 4 ช็อต' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Love Letter' }));
      fireEvent.click(
        screen.getByRole('button', { name: /นับถอยหลังถ่ายโฟโต้บูธ 4 ช็อตพร้อมกัน/i })
      );
      expect(screen.getByText(/ยิ้มและจัดท่าพร้อมกันเลย/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_000);
      });

      expect(compose).toHaveBeenCalledWith(expect.objectContaining({
        layout: 'strip-4',
        frameTheme: 'love-letter',
        shots: Array.from({ length: 4 }, () => ({ p1DataUrl: null, p2DataUrl: null })),
      }));
      expect(screen.getByRole('img', { name: 'ภาพคู่สี่ช็อต' })).toHaveAttribute('src', 'blob:strip-test');
      expect(screen.getByText(/อัลบั้มภาพคืนนี้ของเรา \(1 ภาพ\)/i)).toBeInTheDocument();
      r7.unmount();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      compose.mockRestore();
    }

    // 08: Pier Synchronized Release -> Score-Free Keepsake Card
    render(<ActivityHarness spotId="pier-royal" />);
    fireEvent.click(screen.getByRole('button', { name: /ประคองฝั่ง ฟ้าใส/i }));
    fireEvent.click(screen.getByRole('button', { name: /ประคองฝั่ง ต้นกล้า/i }));
    expect(screen.getByText(/การ์ดที่ระลึกคืนเพ็ญของเราสองคน/i)).toBeInTheDocument();
    expect(screen.queryByText(/\/300/)).toBeNull();
    expect(screen.queryByText(/คะแนนรวม/)).toBeNull();
  });

  it('keeps the live webcam stream active across parent re-renders and stops tracks only on unmount', async () => {
    const stopSpy = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop: stopSpy }],
    } as unknown as MediaStream;

    const getUserMediaSpy = vi.fn().mockResolvedValue(fakeStream);
    const origMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaSpy },
    });

    const base = createInitialGameState();
    try {
      const { rerender, unmount } = render(
        <ScenicPhotoActivity
          spotId="pavilion-blessing"
          activePose="heart-hands"
          photoMemories={[]}
          players={base.players}
          myRole="p1"
          bothOnline={true}
          lastPhotoEvent={null}
          soundEnabled={false}
          onSetPose={() => {}}
          onSavePhoto={() => {}}
          onSendPhotoFrame={() => {}}
          onSendCamState={() => {}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /เปิดกล้องของฉัน/i }));

      const video = (await waitFor(() =>
        screen.getByLabelText(/ภาพกล้องสดของ ฟ้าใส/i)
      )) as HTMLVideoElement;
      expect(video.srcObject).toBe(fakeStream);
      expect(video.muted).toBe(true);

      // Re-render with fresh inline callbacks & incoming partner frame (previously killed the camera!)
      rerender(
        <ScenicPhotoActivity
          spotId="pavilion-blessing"
          activePose="warm-hug"
          photoMemories={[]}
          players={base.players}
          myRole="p1"
          bothOnline={true}
          lastPhotoEvent={{
            type: 'photobooth_frame',
            playerId: 'p2',
            dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
            mirrored: true,
            filter: 'warm-candle',
            ts: Date.now(),
          }}
          soundEnabled={false}
          onSetPose={() => {}}
          onSavePhoto={() => {}}
          onSendPhotoFrame={() => {}}
          onSendCamState={() => {}}
        />
      );

      expect(stopSpy).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/ภาพกล้องสดของ ฟ้าใส/i)).toBeInTheDocument();

      unmount();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: origMediaDevices,
      });
    }
  });
});
