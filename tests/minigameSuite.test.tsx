import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MinigameSuite } from '../src/components/MinigameSuite';
import { createInitialMinigames } from '../src/domain/minigames';
import type { MinigameId, MinigamesProgress } from '../src/domain/types';

function MinigameHarness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [progress, setProgress] = useState<MinigamesProgress>(createInitialMinigames);

  const handleComplete = (gameId: MinigameId, passed: boolean, score: number) => {
    setProgress((prev) => ({
      ...prev,
      [gameId]: {
        status: passed ? 'passed' : 'failed',
        score,
        attempts: prev[gameId].attempts + 1,
      },
    }));
  };

  const handleReset = (gameId: MinigameId) => {
    setProgress((prev) => ({
      ...prev,
      [gameId]: { status: 'pending', score: 0, attempts: prev[gameId].attempts },
    }));
  };

  return (
    <MinigameSuite
      progress={progress}
      reducedMotion={reducedMotion}
      onCompleteMinigame={handleComplete}
      onResetMinigame={handleReset}
    />
  );
}

describe('MinigameSuite UI flow (3 arcade timing & reflex games)', () => {
  it('supports fail/retry in Canal Stream Catcher (Game 1), Pendulum Stacker (Game 2), and Candle Rhythm (Game 3)', () => {
    render(<MinigameHarness reducedMotion />);

    // Game 1: Fail by scooping 3 decoys, then retry and scoop all 4 sacred offerings in golden zone
    fireEvent.click(screen.getByRole('button', { name: 'เริ่มด่าน 1' }));
    fireEvent.click(screen.getByRole('button', { name: /ใบไม้แห้ง/i }));
    fireEvent.click(screen.getByRole('button', { name: /เศษพลาสติก/i }));
    fireEvent.click(screen.getByRole('button', { name: /ก้อนกรวด/i }));

    expect(screen.getByText(/เลือกวัสดุผิดครบ 3 ครั้ง/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'เล่นด่าน 1 ซ้ำ' }));
    // In reducedMotion, initial streamPos is 0.5 (golden center sweetspot)
    fireEvent.click(screen.getByRole('button', { name: /ใบตองตานีสด/i }));
    fireEvent.click(screen.getByRole('button', { name: /หยวกกล้วย/i }));
    fireEvent.click(screen.getByRole('button', { name: /ดอกบัวชมพู/i }));
    fireEvent.click(screen.getByRole('button', { name: /เทียนหอมคู่/i }));

    expect(screen.getByText(/เยี่ยมมาก! ช้อนยอดวัสดุครบทั้ง 4 ชิ้น/i)).toBeInTheDocument();

    // Game 2: Precision Pendulum Tower Stacker (4 layers)
    fireEvent.click(screen.getByRole('button', { name: /ไปด่าน 2/i }));
    fireEvent.click(screen.getByRole('button', { name: /เริ่มเล็งวางชั้นกระทง/i }));

    for (let layer = 0; layer < 4; layer += 1) {
      fireEvent.click(screen.getByRole('button', { name: /วางชั้นกระทงตรงแกน/i }));
    }

    expect(screen.getByText(/ประกอบกระทงครบ 4 ชั้นสมดุลสวยงาม/i)).toBeInTheDocument();

    // Game 3: Candlelight Rhythm (5 beats)
    fireEvent.click(screen.getByRole('button', { name: /ไปด่าน 3/i }));
    expect(screen.getByText(/โหมดลดการเคลื่อนไหว/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'เริ่มจับจังหวะแสง' }));

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /แตะให้ตรงแสง/i }));
    }

    expect(
      screen.getByText(/ผ่านครบทั้ง 3 ด่านแล้ว|เล่นด่าน 3 ซ้ำ/i)
    ).toBeInTheDocument();
  });
});
