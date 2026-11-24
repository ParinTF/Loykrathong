import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CouplePhotoMemory,
  CouplePoseId,
  PhotoBackdropId,
  PhotoBoothEvent,
  PhotoBoothFilterId,
  PhotoBoothLayoutId,
  PlayerId,
  PlayerProfile,
} from '../../domain/types';
import { playChime } from '../../game/sound';
import { AvatarPreview } from '../AvatarPreview';
import {
  FILTER_CSS,
  FILTER_LABELS,
  captureVideoFrame,
  renderCouplePhotoBoothComposite,
  type CoupleShotPair,
} from './photoBoothCanvas';

interface ScenicPhotoActivityProps {
  spotId: string;
  activePose: CouplePoseId;
  photoMemories: CouplePhotoMemory[];
  players: Record<PlayerId, PlayerProfile>;
  myRole: PlayerId;
  bothOnline: boolean;
  lastPhotoEvent: PhotoBoothEvent | null;
  soundEnabled: boolean;
  onSetPose: (pose: CouplePoseId) => void;
  onSavePhoto: (
    pose: CouplePoseId,
    backdrop: PhotoBackdropId,
    caption: string,
    layout: PhotoBoothLayoutId,
    compositeDataUrl: string | null
  ) => void;
  onSendPhotoFrame?: (
    dataUrl: string,
    mirrored: boolean,
    filter: PhotoBoothFilterId
  ) => void;
  onSendCamState?: (active: boolean) => void;
  onSendShutter?: (payload: {
    sessionId: string;
    layout: PhotoBoothLayoutId;
    backdrop: PhotoBackdropId;
    pose: CouplePoseId;
    caption: string;
  }) => void;
  onSendSnap?: (
    sessionId: string,
    shotIndex: number,
    dataUrl: string | null
  ) => void;
}

const POSES: { id: CouplePoseId; label: string; emoji: string; guide: string }[] = [
  { id: 'heart-hands', label: 'ครึ่งหัวใจชนกัน', emoji: '🫶', guide: 'ยกมือชิดเส้นกลางจอให้มาชนกันเป็นหัวใจ' },
  { id: 'sit-moon', label: 'เอียงหัวซบไหล่', emoji: '🌕', guide: 'เอียงศีรษะเข้าหาเส้นกลางจอเหมือนพิงไหล่กัน' },
  { id: 'hold-hands', label: 'ส่งมือจับกัน', emoji: '🤝', guide: 'ยื่นมือชิดขอบกลางจอเหมือนกำลังจับมือกัน' },
  { id: 'warm-hug', label: 'กอดอุ่น ๆ', emoji: '🫂', guide: 'โอบแขนเข้าหาเส้นกลางจอแล้วส่งยิ้มอบอุ่น' },
];

const BACKDROPS: { id: PhotoBackdropId; label: string }[] = [
  { id: 'sala', label: 'กรอบศาลาคืนเพ็ญ' },
  { id: 'yipeng', label: 'กรอบโคมยี่เป็ง' },
  { id: 'river', label: 'กรอบสายน้ำจันทร์เพ็ญ' },
  { id: 'cream-minimal', label: 'กรอบครีมมินิมอล' },
];

const LAYOUTS: { id: PhotoBoothLayoutId; label: string; desc: string }[] = [
  { id: 'polaroid', label: '🖼️ โพลารอยด์ 1 ภาพ', desc: 'ภาพคู่ใบใหญ่คมชัด' },
  { id: 'strip-4', label: '🎞️ โฟโต้บูธ 4 ช็อต', desc: 'ถ่ายต่อเนื่อง 4 ท่าแบบสติกเกอร์' },
];

const FILTERS: PhotoBoothFilterId[] = [
  'natural',
  'warm-candle',
  'moonlight-film',
  'classic-bw',
];

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function ScenicPhotoActivity({
  spotId,
  activePose,
  photoMemories,
  players,
  myRole,
  bothOnline,
  lastPhotoEvent,
  soundEnabled,
  onSetPose,
  onSavePhoto,
  onSendPhotoFrame,
  onSendCamState,
  onSendShutter,
  onSendSnap,
}: ScenicPhotoActivityProps) {
  const partnerRole: PlayerId = myRole === 'p1' ? 'p2' : 'p1';
  const defaultBackdrop: PhotoBackdropId =
    spotId === 'scenic-bench' ? 'river' : 'sala';

  const [layout, setLayout] = useState<PhotoBoothLayoutId>('polaroid');
  const [backdrop, setBackdrop] = useState<PhotoBackdropId>(defaultBackdrop);
  const [filter, setFilter] = useState<PhotoBoothFilterId>('warm-candle');
  const [mirrored, setMirrored] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [showCenterGuide, setShowCenterGuide] = useState(true);
  const [caption, setCaption] = useState(
    `คืนเพ็ญแสนอบอุ่นของ ${players.p1.name} และ ${players.p2.name}`
  );

  // Camera state
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [partnerCamOn, setPartnerCamOn] = useState(false);
  const [partnerLiveFrame, setPartnerLiveFrame] = useState<string | null>(null);

  // Shutter & composite result state
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShotNumber, setCurrentShotNumber] = useState<number>(0);
  const [totalShotsInRun, setTotalShotsInRun] = useState<number>(1);
  const [flashActive, setFlashActive] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [latestHdPhoto, setLatestHdPhoto] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const shutterTimersRef = useRef<number[]>([]);
  const lastHandledEventRef = useRef<PhotoBoothEvent | null>(null);

  // Keep latest props & state in refs so parent re-renders NEVER tear down the live camera stream
  const onSendPhotoFrameRef = useRef(onSendPhotoFrame);
  onSendPhotoFrameRef.current = onSendPhotoFrame;
  const onSendCamStateRef = useRef(onSendCamState);
  onSendCamStateRef.current = onSendCamState;
  const onSendSnapRef = useRef(onSendSnap);
  onSendSnapRef.current = onSendSnap;
  const onSavePhotoRef = useRef(onSavePhoto);
  onSavePhotoRef.current = onSavePhoto;
  const playersRef = useRef(players);
  playersRef.current = players;
  const captionRef = useRef(caption);
  captionRef.current = caption;

  const partnerFrameRef = useRef<string | null>(null);
  partnerFrameRef.current = partnerLiveFrame;
  const cameraOnRef = useRef(cameraOn);
  cameraOnRef.current = cameraOn;
  const mirroredRef = useRef(mirrored);
  mirroredRef.current = mirrored;
  const filterRef = useRef(filter);
  filterRef.current = filter;

  // Tracks in-flight synchronized session shots from both P1 and P2
  const activeSessionRef = useRef<{
    sessionId: string;
    layout: PhotoBoothLayoutId;
    backdrop: PhotoBackdropId;
    pose: CouplePoseId;
    caption: string;
    totalShots: number;
    isInitiator: boolean;
    shots: { p1?: string | null; p2?: string | null }[];
    finalized: boolean;
    finalizeTimer?: number;
  } | null>(null);

  const attachStreamToVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el || !streamRef.current) return;
    el.muted = true;
    el.playsInline = true;
    if (el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
    }
    const playPromise = el.play?.();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (frameIntervalRef.current !== null) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
    onSendCamStateRef.current?.(false);
  }, []);

  const startCamera = useCallback(
    async (requestedFacing: 'user' | 'environment' = facingMode) => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        setCameraError(
          'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง หรือต้องเปิดผ่าน HTTPS — ยังสามารถถ่ายรูปคู่ด้วยอวตาร/รูปโปรไฟล์ได้ตามปกติ'
        );
        return;
      }

      setCameraBusy(true);
      setCameraError(null);
      try {
        if (streamRef.current) {
          for (const t of streamRef.current.getTracks()) t.stop();
          streamRef.current = null;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: requestedFacing },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        } catch (constraintErr) {
          // Retry with unconstrained default camera if device rejects facingMode/resolution
          if (
            constraintErr instanceof DOMException &&
            constraintErr.name === 'NotAllowedError'
          ) {
            throw constraintErr;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!mountedRef.current) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }

        streamRef.current = stream;
        setCameraOn(true);
        onSendCamStateRef.current?.(true);
        if (videoRef.current) {
          attachStreamToVideo(videoRef.current);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'ยังไม่ได้อนุญาตให้เข้าถึงกล้อง กรุณากดอนุญาตกล้องที่แถบที่อยู่ของเบราว์เซอร์แล้วลองใหม่'
            : 'ไม่พบกล้องหรือกล้องกำลังถูกใช้งานโดยแอปอื่น — คุณยังสามารถถ่ายด้วยอวตาร/รูปโปรไฟล์คู่กับกล้องของแฟนได้';
        setCameraError(msg);
        setCameraOn(false);
        onSendCamStateRef.current?.(false);
      } finally {
        if (mountedRef.current) {
          setCameraBusy(false);
        }
      }
    },
    [attachStreamToVideo, facingMode]
  );

  // Re-attach MediaStream once <video> mounts after cameraOn becomes true
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      attachStreamToVideo(videoRef.current);
    }
  }, [cameraOn, attachStreamToVideo]);

  // Stream lightweight live camera preview frames to partner (~4.5 fps)
  // Uses onSendPhotoFrameRef so parent re-renders NEVER reset the interval!
  useEffect(() => {
    if (!cameraOn || !bothOnline) return undefined;

    const pushFrame = () => {
      if (!videoRef.current || !cameraOnRef.current || !onSendPhotoFrameRef.current) {
        return;
      }
      const frame = captureVideoFrame(
        videoRef.current,
        240,
        300,
        mirroredRef.current,
        filterRef.current,
        0.58
      );
      if (frame) {
        onSendPhotoFrameRef.current(frame, mirroredRef.current, filterRef.current);
      }
    };

    const id = window.setInterval(pushFrame, 220);
    frameIntervalRef.current = id;
    pushFrame();
    return () => {
      window.clearInterval(id);
      if (frameIntervalRef.current === id) frameIntervalRef.current = null;
    };
  }, [cameraOn, bothOnline]);

  // Stop webcam & timers ONLY when the modal actually unmounts (empty deps!)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const t of shutterTimersRef.current) window.clearTimeout(t);
      shutterTimersRef.current = [];
      if (activeSessionRef.current?.finalizeTimer) {
        window.clearTimeout(activeSessionRef.current.finalizeTimer);
      }
      if (frameIntervalRef.current !== null) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
      onSendCamStateRef.current?.(false);
    };
  }, []);

  const finalizePhotoSession = useCallback(async () => {
    const sess = activeSessionRef.current;
    if (!sess || sess.finalized) return;
    sess.finalized = true;
    if (sess.finalizeTimer) {
      window.clearTimeout(sess.finalizeTimer);
      sess.finalizeTimer = undefined;
    }

    setDeveloping(true);
    const pairs: CoupleShotPair[] = Array.from(
      { length: sess.totalShots },
      (_, idx) => {
        const s = sess.shots[idx] ?? {};
        return {
          p1DataUrl:
            s.p1 ??
            (myRole === 'p2' ? partnerFrameRef.current : null) ??
            null,
          p2DataUrl:
            s.p2 ??
            (myRole === 'p1' ? partnerFrameRef.current : null) ??
            null,
        };
      }
    );

    const rendered = await renderCouplePhotoBoothComposite({
      shots: pairs,
      p1: playersRef.current.p1,
      p2: playersRef.current.p2,
      layout: sess.layout,
      backdrop: sess.backdrop,
      pose: sess.pose,
      caption: sess.caption,
    });

    if (!mountedRef.current) return;
    setDeveloping(false);
    setCountdown(null);
    setCurrentShotNumber(0);
    if (rendered.hdPngDataUrl) {
      setLatestHdPhoto(rendered.hdPngDataUrl);
    }

    if (sess.isInitiator) {
      onSavePhotoRef.current(
        sess.pose,
        sess.backdrop,
        sess.caption,
        sess.layout,
        rendered.compactJpegDataUrl ?? rendered.hdPngDataUrl
      );
    }
  }, [myRole]);

  const checkSessionComplete = useCallback(() => {
    const sess = activeSessionRef.current;
    if (!sess || sess.finalized) return;
    const allHaveMine = sess.shots.every((s) =>
      myRole === 'p1' ? s.p1 !== undefined : s.p2 !== undefined
    );
    const allHavePartner =
      !bothOnline ||
      sess.shots.every((s) =>
        partnerRole === 'p1' ? s.p1 !== undefined : s.p2 !== undefined
      );
    if (allHaveMine && allHavePartner) {
      void finalizePhotoSession();
    }
  }, [bothOnline, finalizePhotoSession, myRole, partnerRole]);

  const runShutterSequence = useCallback(
    (params: {
      sessionId: string;
      layout: PhotoBoothLayoutId;
      backdrop: PhotoBackdropId;
      pose: CouplePoseId;
      caption: string;
      isInitiator: boolean;
    }) => {
      for (const t of shutterTimersRef.current) window.clearTimeout(t);
      shutterTimersRef.current = [];
      if (activeSessionRef.current?.finalizeTimer) {
        window.clearTimeout(activeSessionRef.current.finalizeTimer);
      }

      const totalShots = params.layout === 'strip-4' ? 4 : 1;
      activeSessionRef.current = {
        ...params,
        totalShots,
        shots: Array.from({ length: totalShots }, () => ({})),
        finalized: false,
      };
      setTotalShotsInRun(totalShots);

      const scheduleShot = (shotIndex: number) => {
        setCurrentShotNumber(shotIndex + 1);
        setCountdown(3);
        playChime('beat', soundEnabled);

        const t1 = window.setTimeout(() => {
          setCountdown(2);
          playChime('beat', soundEnabled);
        }, 750);
        const t2 = window.setTimeout(() => {
          setCountdown(1);
          playChime('beat', soundEnabled);
        }, 1500);
        const t3 = window.setTimeout(() => {
          setCountdown(0);
          playChime('success', soundEnabled);
          setFlashActive(true);
          const tf = window.setTimeout(() => setFlashActive(false), 320);
          shutterTimersRef.current.push(tf);

          const mySnap =
            cameraOnRef.current && videoRef.current
              ? captureVideoFrame(
                  videoRef.current,
                  480,
                  600,
                  mirroredRef.current,
                  filterRef.current,
                  0.86
                )
              : null;

          const sess = activeSessionRef.current;
          if (sess && sess.sessionId === params.sessionId) {
            if (myRole === 'p1') sess.shots[shotIndex].p1 = mySnap;
            else sess.shots[shotIndex].p2 = mySnap;
            if (!bothOnline) {
              if (myRole === 'p1') sess.shots[shotIndex].p2 = null;
              else sess.shots[shotIndex].p1 = null;
            }
          }

          if (bothOnline) {
            onSendSnapRef.current?.(params.sessionId, shotIndex, mySnap);
          }

          if (shotIndex + 1 < totalShots) {
            const tNext = window.setTimeout(() => {
              scheduleShot(shotIndex + 1);
            }, 900);
            shutterTimersRef.current.push(tNext);
          } else {
            if (sess) {
              sess.finalizeTimer = window.setTimeout(() => {
                void finalizePhotoSession();
              }, bothOnline ? 2200 : 120);
            }
            checkSessionComplete();
          }
        }, 2250);

        shutterTimersRef.current.push(t1, t2, t3);
      };

      scheduleShot(0);
    },
    [bothOnline, checkSessionComplete, finalizePhotoSession, myRole, soundEnabled]
  );

  // React to each incoming WebSocket Photo Booth event exactly once
  useEffect(() => {
    if (!lastPhotoEvent || lastPhotoEvent === lastHandledEventRef.current) {
      return;
    }
    lastHandledEventRef.current = lastPhotoEvent;

    if (
      lastPhotoEvent.type === 'photobooth_frame' &&
      lastPhotoEvent.playerId === partnerRole
    ) {
      setPartnerCamOn(true);
      setPartnerLiveFrame(lastPhotoEvent.dataUrl);
      return;
    }

    if (
      lastPhotoEvent.type === 'photobooth_cam_state' &&
      lastPhotoEvent.playerId === partnerRole
    ) {
      setPartnerCamOn(lastPhotoEvent.active);
      if (!lastPhotoEvent.active) setPartnerLiveFrame(null);
      return;
    }

    if (lastPhotoEvent.type === 'photobooth_shutter') {
      if (activeSessionRef.current?.sessionId === lastPhotoEvent.sessionId) {
        return;
      }
      setLayout(lastPhotoEvent.layout);
      setBackdrop(lastPhotoEvent.backdrop);
      const nextCaption = lastPhotoEvent.caption || captionRef.current;
      setCaption(nextCaption);
      runShutterSequence({
        sessionId: lastPhotoEvent.sessionId,
        layout: lastPhotoEvent.layout,
        backdrop: lastPhotoEvent.backdrop,
        pose: lastPhotoEvent.pose,
        caption: nextCaption,
        isInitiator: lastPhotoEvent.playerId === myRole,
      });
      return;
    }

    if (lastPhotoEvent.type === 'photobooth_snap') {
      const sess = activeSessionRef.current;
      if (!sess || sess.sessionId !== lastPhotoEvent.sessionId) return;
      const slot = sess.shots[lastPhotoEvent.shotIndex];
      if (!slot) return;
      if (lastPhotoEvent.playerId === 'p1') slot.p1 = lastPhotoEvent.dataUrl;
      else slot.p2 = lastPhotoEvent.dataUrl;
      checkSessionComplete();
    }
  }, [lastPhotoEvent, partnerRole, myRole, runShutterSequence, checkSessionComplete]);

  const handleStartBoothShutter = () => {
    if (countdown !== null || developing) return;
    const sessionId = `pb-${myRole}-${Date.now()}`;
    if (bothOnline && onSendShutter) {
      onSendShutter({
        sessionId,
        layout,
        backdrop,
        pose: activePose,
        caption,
      });
    }
    runShutterSequence({
      sessionId,
      layout,
      backdrop,
      pose: activePose,
      caption,
      isInitiator: true,
    });
  };

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (cameraOn) {
      void startCamera(nextFacing);
    }
  };

  const poseMeta = POSES.find((p) => p.id === activePose) ?? POSES[0];

  const renderSlot = (slotRole: PlayerId) => {
    const isMine = slotRole === myRole;
    const profile = players[slotRole];
    const hasLiveCam = isMine ? cameraOn : partnerCamOn && Boolean(partnerLiveFrame);

    return (
      <div className="booth-slot" data-role={slotRole}>
        <span className={`booth-slot__badge ${hasLiveCam ? 'is-live' : ''}`}>
          {hasLiveCam ? '● กล้องสด' : '🌙 อวตาร'} · {profile.name}
        </span>

        {isMine && cameraOn ? (
          <video
            ref={attachStreamToVideo}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(event) => {
              const el = event.currentTarget;
              el.muted = true;
              void el.play?.().catch(() => {});
            }}
            className="booth-slot__media"
            style={{
              transform: mirrored ? 'scaleX(-1)' : 'none',
              filter: FILTER_CSS[filter],
            }}
            aria-label={`ภาพกล้องสดของ ${profile.name}`}
          />
        ) : !isMine && partnerCamOn && partnerLiveFrame ? (
          <img
            src={partnerLiveFrame}
            alt={`ภาพกล้องสดของ ${profile.name}`}
            className="booth-slot__media"
          />
        ) : (
          <div className="booth-slot__avatar-fallback">
            <AvatarPreview profile={profile} size={76} />
            <p className="booth-slot__hint">
              {isMine
                ? 'กด “เปิดกล้องของฉัน” ด้านล่างเพื่อถ่ายรูปคู่แบบเห็นหน้ากัน'
                : bothOnline
                  ? `กำลังรอ ${profile.name} กดเปิดกล้อง (หรือถ่ายคู่กับอวตารได้เลย)`
                  : `รอ ${profile.name} เข้าห้อง — สามารถลองเปิดกล้องของคุณทดสอบก่อนได้เลย`}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      className="romantic-activity scenic-photo-activity"
      aria-label="Online Couple Photo Booth ถ่ายรูปคู่ข้ามระยะทาง"
    >
      <div className="dialogue-bubble">
        <p>
          <strong>📸 Online Couple Photo Booth:</strong> เปิดกล้องพร้อมกันแม้อยู่คนละที่!
          จัดท่าให้มือหรือไหล่ชิดเส้นกลางจอ แล้วกดนับถอยหลังถ่ายพร้อมกันได้ทั้งแบบ{' '}
          <strong>โพลารอยด์ 1 ภาพ</strong> และ <strong>โฟโต้บูธ 4 ช็อต (4-Cut)</strong>
        </p>
      </div>

      {/* Camera Control Strip */}
      <div className="booth-camera-bar">
        {!cameraOn ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={cameraBusy}
            onClick={() => void startCamera()}
          >
            {cameraBusy ? 'กำลังเปิดกล้อง…' : '📷 เปิดกล้องของฉัน'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={stopCamera}
            >
              🚫 ปิดกล้อง
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleFlipCamera}
            >
              🔄 สลับกล้องหน้า/หลัง
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              aria-pressed={mirrored}
              onClick={() => setMirrored((m) => !m)}
            >
              🪞 กระจก: {mirrored ? 'เปิด' : 'ปิด'}
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          aria-pressed={showCenterGuide}
          onClick={() => setShowCenterGuide((v) => !v)}
        >
          🫶 เส้นไกด์ชนมือ: {showCenterGuide ? 'แสดง' : 'ซ่อน'}
        </button>
      </div>

      {cameraError && (
        <p className="booth-camera-error" role="alert">
          {cameraError}
        </p>
      )}

      {/* Split-Screen Live Online Couple Photo Booth Viewfinder */}
      <div
        className={`booth-stage booth-stage--${backdrop} ${flashActive ? 'is-flashing' : ''}`}
      >
        <div className="booth-stage__split">
          {renderSlot('p1')}
          {renderSlot('p2')}

          {showCenterGuide && (
            <div className="booth-center-guide" aria-hidden="true">
              <div className="booth-center-guide__seam" />
              <span className="booth-center-guide__heart">{poseMeta.emoji}</span>
            </div>
          )}
        </div>

        <p className="booth-stage__tip">{poseMeta.guide}</p>

        {countdown !== null && countdown > 0 && (
          <div className="booth-countdown-overlay" role="status" aria-live="assertive">
            {totalShotsInRun > 1 && (
              <span className="booth-countdown-overlay__shot">
                ช็อตที่ {currentShotNumber} / {totalShotsInRun}
              </span>
            )}
            <strong>{countdown}</strong>
            <span>ยิ้มและจัดท่าพร้อมกันเลย!</span>
          </div>
        )}

        {developing && (
          <div className="booth-countdown-overlay" role="status">
            <span>✨ กำลังล้างฟิล์มและรวมภาพคู่ความคมชัดสูง…</span>
          </div>
        )}
      </div>

      {/* Primary Shutter Button */}
      <div className="dialog-actions booth-shutter-row">
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={countdown !== null || developing}
          onClick={handleStartBoothShutter}
        >
          {countdown !== null
            ? `กำลังถ่ายภาพ (${countdown})…`
            : layout === 'strip-4'
              ? '🎞️ นับถอยหลังถ่ายโฟโต้บูธ 4 ช็อตพร้อมกัน'
              : '📸 นับถอยหลังถ่ายรูปคู่พร้อมกัน (3… 2… 1)'}
        </button>
      </div>

      {/* Finished HD Couple Photo Result Preview */}
      {latestHdPhoto && (
        <div className="booth-result-card" role="region" aria-label="ภาพถ่ายคู่ล่าสุดจาก Photo Booth">
          <div className="booth-result-card__head">
            <strong>✨ ล้างฟิล์มเสร็จแล้ว! ภาพคู่ของเราสองคน</strong>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() =>
                downloadDataUrl(
                  latestHdPhoto,
                  `loykratong-photobooth-${layout}.png`
                )
              }
            >
              💾 ดาวน์โหลดภาพ (.PNG)
            </button>
          </div>
          <img
            src={latestHdPhoto}
            alt="ภาพถ่ายคู่รักจาก Online Photo Booth"
            className={`booth-result-card__img ${layout === 'strip-4' ? 'is-strip' : ''}`}
          />
        </div>
      )}

      {/* Layout, Filter, Pose & Frame Customization */}
      <div className="booth-options-grid">
        <fieldset className="swatch-fieldset">
          <legend className="field-label">รูปแบบ Photo Booth</legend>
          <div className="chip-grid">
            {LAYOUTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pose-chip ${layout === item.id ? 'is-selected' : ''}`}
                aria-pressed={layout === item.id}
                onClick={() => {
                  playChime('beat', soundEnabled);
                  setLayout(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="swatch-fieldset">
          <legend className="field-label">ฟิลเตอร์แสง</legend>
          <div className="chip-grid">
            {FILTERS.map((fid) => (
              <button
                key={fid}
                type="button"
                className={`pose-chip ${filter === fid ? 'is-selected' : ''}`}
                aria-pressed={filter === fid}
                onClick={() => {
                  playChime('beat', soundEnabled);
                  setFilter(fid);
                }}
              >
                {FILTER_LABELS[fid]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="swatch-fieldset">
          <legend className="field-label">ไอเดียท่าถ่ายคู่ (ซิงก์ทั้งสองคน)</legend>
          <div className="chip-grid">
            {POSES.map((pose) => (
              <button
                key={pose.id}
                type="button"
                className={`pose-chip ${activePose === pose.id ? 'is-selected' : ''}`}
                aria-pressed={activePose === pose.id}
                onClick={() => {
                  playChime('beat', soundEnabled);
                  onSetPose(pose.id);
                }}
              >
                <span aria-hidden="true">{pose.emoji}</span> {pose.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="swatch-fieldset">
          <legend className="field-label">ธีมกรอบรูป</legend>
          <div className="chip-grid">
            {BACKDROPS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                className={`pose-chip ${backdrop === bg.id ? 'is-selected' : ''}`}
                aria-pressed={backdrop === bg.id}
                onClick={() => setBackdrop(bg.id)}
              >
                {bg.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="field-group">
        <label htmlFor="photo-caption-input" className="field-label">
          ข้อความบนกรอบโพลารอยด์
        </label>
        <input
          id="photo-caption-input"
          type="text"
          className="text-input"
          maxLength={90}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>

      {photoMemories.length > 0 && (
        <div className="photo-album-strip" aria-label="อัลบั้มภาพคู่คืนนี้">
          <h3 className="field-label">
            อัลบั้มภาพคืนนี้ของเรา ({photoMemories.length} ภาพ)
          </h3>
          <div className="photo-album-grid">
            {photoMemories
              .slice()
              .reverse()
              .slice(0, 4)
              .map((photo) => {
                const pm = POSES.find((p) => p.id === photo.pose) ?? POSES[0];
                return (
                  <article key={photo.id} className="polaroid-mini">
                    {photo.compositeDataUrl && (
                      <img
                        src={photo.compositeDataUrl}
                        alt={photo.caption}
                        className="polaroid-mini__thumb"
                      />
                    )}
                    <span className="polaroid-mini__pose">
                      {pm.emoji} {pm.label}
                    </span>
                    <p className="polaroid-mini__cap">“{photo.caption}”</p>
                    {photo.compositeDataUrl && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() =>
                          downloadDataUrl(
                            photo.compositeDataUrl!,
                            `loykratong-${photo.id}.jpg`
                          )
                        }
                      >
                        💾 บันทึกภาพนี้
                      </button>
                    )}
                  </article>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}
