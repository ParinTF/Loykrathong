import { useId, useState, type ReactNode } from 'react';
import { MATERIAL_LABELS, MINIGAME_TITLES } from '../../domain/reducer';
import type { GameState, MaterialId } from '../../domain/types';
import { LANTERN_SPOTS } from '../../domain/worldMap';
import { HudIcon } from './HudPrimitives';

export interface HudQuest {
  stage: GameState['questStage'];
  inventory: GameState['inventory'];
  minigames: GameState['minigames'];
  lanterns: number;
  blessed: boolean;
  released: number;
  progress: number;
}

const materials = Object.keys(MATERIAL_LABELS) as MaterialId[];
const minigames = ['recipe', 'assembly', 'rhythm'] as const;

function objective(quest: HudQuest): [string, string] {
  switch (quest.stage) {
    case 'explore': {
      const next = materials.find((key) => !quest.inventory[key]);
      return ['รวบรวมวัสดุทำกระทง', next ? MATERIAL_LABELS[next].hint : 'นำวัสดุไปที่โต๊ะประดิษฐ์'];
    }
    case 'craft': {
      const next = minigames.find((key) => quest.minigames[key].status !== 'passed');
      return ['ประดิษฐ์กระทงด้วยกัน', next ? `ไปที่โต๊ะประดิษฐ์เพื่อเล่น${MINIGAME_TITLES[next]}` : 'ประกอบกระทงและเขียนคำอธิษฐาน'];
    }
    case 'ceremony':
      return ['ปล่อยกระทงแสงจันทร์', 'นำกระทงไปที่ท่าน้ำเพื่อทำพิธีร่วมกัน'];
    case 'released':
      return [`ลอยกระทงแล้ว ${quest.released} ใบ`, 'กลับไปที่โต๊ะประดิษฐ์เพื่อเริ่มทำกระทงใบใหม่'];
  }
}

function QuestCheck({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <li className={complete ? 'is-complete' : undefined}>
      <span className="visually-hidden">{complete ? 'สำเร็จแล้ว' : 'ยังไม่สำเร็จ'}</span>
      <HudIcon name={complete ? 'check' : 'spark'} />
      <div>{children}</div>
    </li>
  );
}

export function QuestTracker({ quest }: { quest: HudQuest }) {
  const [open, setOpen] = useState(() => window.matchMedia?.('(min-width: 760px)').matches ?? false);
  const objectiveId = useId();
  const [title, hint] = objective(quest);
  return (
    <aside className="hud-quest hud-surface" aria-label="ภารกิจลอยกระทง">
      <button className="hud-quest__toggle" type="button" aria-expanded={open}
        aria-controls={objectiveId} onClick={() => setOpen((value) => !value)}>
        <HudIcon name="quest" />
        <span>ภารกิจ</span>
        <span className="hud-quest__percent">{quest.progress}%</span>
        <HudIcon name="chevron" className="hud-chevron" />
      </button>
      <div className="hud-quest__body" id={objectiveId} hidden={!open}>
        <div className="hud-quest__progress" role="progressbar" aria-label="ความคืบหน้าภารกิจ"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={quest.progress}>
          <span style={{ width: `${quest.progress}%` }} />
        </div>
        <h2>{title}</h2>
        <p className="hud-quest__hint">{hint}</p>
        <details className="hud-quest__details">
          <summary>ดูภารกิจทั้งหมด</summary>
          <ul className="hud-quest__steps">
            {materials.map((key) => (
              <QuestCheck key={key} complete={quest.inventory[key]}>
                <strong>{MATERIAL_LABELS[key].name}</strong>
                <span>{MATERIAL_LABELS[key].hint}</span>
              </QuestCheck>
            ))}
            {minigames.map((key) => (
              <QuestCheck key={key} complete={quest.minigames[key].status === 'passed'}>
                {MINIGAME_TITLES[key]}
                {quest.minigames[key].status === 'passed' ? ` · ${quest.minigames[key].score} คะแนน` : ''}
              </QuestCheck>
            ))}
            <QuestCheck complete={quest.lanterns === LANTERN_SPOTS.length}>
              จุดโคมยี่เป็ง {quest.lanterns}/{LANTERN_SPOTS.length} ดวง
            </QuestCheck>
            <QuestCheck complete={quest.blessed}>รับพรที่ศาลาคู่รักแสงจันทร์</QuestCheck>
            <QuestCheck complete={quest.released > 0}>ปล่อยกระทงที่ท่าน้ำแสงจันทร์</QuestCheck>
          </ul>
        </details>
      </div>
    </aside>
  );
}
