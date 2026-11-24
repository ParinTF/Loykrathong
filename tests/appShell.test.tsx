import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameShell } from '../src/components/GameShell';

describe('GameShell UI, Accessibility & Minigame Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders accessible character customization for 2 players, validates invalid photo locally, and transitions to world & reset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<GameShell disablePhaser />);

    expect(
      screen.getByRole('heading', { level: 1, name: /คืนเพ็ญริมน้ำ/i })
    ).toBeInTheDocument();

    const nameInputs = screen.getAllByLabelText('ชื่อตัวละคร');
    expect(nameInputs).toHaveLength(2);
    fireEvent.change(nameInputs[0], { target: { value: 'จันทร์เจ้า' } });

    const fileInputs = screen.getAllByLabelText(/รูปใบหน้า/i);
    const badFile = new File(['bad'], 'evil.txt', { type: 'text/plain' });
    fireEvent.change(fileInputs[0], { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByText(/รองรับเฉพาะไฟล์รูปภาพ/i)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    // Enter world
    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่งานลอยกระทงคู่กัน/i }));

    expect(await screen.findByText('จันทร์เจ้า')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /เดินขึ้น/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /รีเซ็ต/i })).toBeInTheDocument();

    // Reset confirmation modal
    fireEvent.click(screen.getByRole('button', { name: /รีเซ็ต/i }));
    expect(screen.getByText(/ยืนยันการรีเซ็ตข้อมูลทั้งหมด/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ยืนยันรีเซ็ตทั้งหมด/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /คืนเพ็ญริมน้ำ/i })
      ).toBeInTheDocument();
    });
    fetchSpy.mockRestore();
  });
});