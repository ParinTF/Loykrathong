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

describe('MinigameSuite UI flow (3 sequential games)', () => {
  it('supports fail/retry in Minigame 1 and sequential completion through Minigame 3', () => {
    render(<MinigameHarness reducedMotion />);

    fireEvent.click(screen.getByRole('button', { name: 'เริ่มด่าน 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'ใบไม้แห้ง' }));
    fireEvent.click(screen.getByRole('button', { name: 'เศษพลาสติก' }));
    fireEvent.click(screen.getByRole('button', { name: 'ก้อนกรวด' }));

    expect(screen.getByText(/เลือกวัสดุผิดครบ 3 ครั้ง/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'เล่นด่าน 1 ซ้ำ' }));
    fireEvent.click(screen.getByRole('button', { name: 'ใบตองตานีสด' }));
    fireEvent.click(screen.getByRole('button', { name: 'หยวกกล้วย' }));
    fireEvent.click(screen.getByRole('button', { name: 'ดอกบัวชมพู' }));
    fireEvent.click(screen.getByRole('button', { name: 'เทียนหอมคู่' }));

    expect(screen.getByText(/เยี่ยมมาก!/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ไปด่าน 2/i }));
    fireEvent.click(screen.getByRole('button', { name: '1. ฐานหยวกกล้วย' }));
    fireEvent.click(screen.getByRole('button', { name: '2. กลีบใบตองพับ' }));
    fireEvent.click(screen.getByRole('button', { name: '3. พวงดอกไม้คู่' }));
    fireEvent.click(screen.getByRole('button', { name: '4. ธูปเทียนอธิษฐาน' }));

    expect(screen.getByText(/ประกอบกระทงครบ 4 ชั้น/i)).toBeInTheDocument();

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