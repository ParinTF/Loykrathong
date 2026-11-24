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

    // Verify new romantic 3D landing page sections & pauseable ambient motion control
    expect(
      screen.getByRole('navigation', { name: /เมนูหลักหน้าแรก/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /4 โมเมนต์พิเศษ/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /แรงบันดาลใจจาก 6 สถานที่จริง/i })
    ).toBeInTheDocument();

    const pauseBtn = screen.getByRole('button', { name: /พักเอฟเฟกต์โคมลอย/i });
    fireEvent.click(pauseBtn);
    expect(
      screen.getByRole('button', { name: /เล่นเอฟเฟกต์โคมลอย/i })
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
    expect(screen.queryByRole('button', { name: /โต้ตอบ:/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'สลับเป็นปุ่มทิศทาง' }));
    expect(screen.getByRole('button', { name: /เดินขึ้น/i })).toBeInTheDocument();

    // Reset confirmation modal
    fireEvent.click(screen.getByRole('button', { name: 'ตั้งค่า' }));
    expect(screen.getByRole('dialog', { name: 'ตั้งค่า' })).toBeInTheDocument();
    const qualityPicker = screen.getByRole('combobox', { name: 'คุณภาพกราฟิก' });
    expect(qualityPicker).toHaveValue('auto');
    fireEvent.change(qualityPicker, { target: { value: 'low' } });
    expect(qualityPicker).toHaveValue('low');
    fireEvent.click(screen.getByRole('button', { name: 'รีเซ็ตข้อมูลเกม' }));
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
