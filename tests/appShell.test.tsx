import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameShell } from '../src/components/GameShell';

describe('GameShell Invitation Screen, Score-Free Memories HUD, Wardrobe & Reset', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('validates invalid photo locally, enters world with score-free/percent-free Memories HUD, opens Wardrobe & Settings, and resets cleanly', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<GameShell disablePhaser offlineDemo />);

    expect(
      screen.getByRole('heading', { level: 1, name: /คืนเพ็ญของเราสองคน/i })
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText('ชื่อของคุณ');
    fireEvent.change(nameInput, { target: { value: 'จันทร์เจ้า' } });

    // Choose character gender before entering the room
    const maleRadio = screen.getByRole('radio', { name: 'ผู้ชาย' });
    fireEvent.click(maleRadio);
    expect(maleRadio).toBeChecked();

    const fileInput = screen.getByLabelText(/อัปโหลดรูป/i);
    const badFile = new File(['bad'], 'evil.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByText(/รองรับเฉพาะไฟล์รูปภาพ/i)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    // Enter world
    fireEvent.click(
      screen.getByRole('button', { name: /เริ่มต้นคืนพิเศษด้วยกัน/i })
    );

    expect(await screen.findByText('จันทร์เจ้า')).toBeInTheDocument();

    // Verify NO 0-100% progressbar exists on the Memories HUD!
    expect(screen.getByText(/คืนนี้ของเรา/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: /ความคืบหน้า/i })).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();

    // Switch touch controls to d-pad
    fireEvent.click(screen.getByRole('button', { name: 'สลับเป็นปุ่มทิศทาง' }));
    expect(screen.getByRole('button', { name: /เดินขึ้น/i })).toBeInTheDocument();

    // Open in-world WardrobePanel, verify chosen gender persisted, and pick gold-lotus accessory
    fireEvent.click(screen.getByRole('button', { name: 'แต่งตัว' }));
    expect(screen.getByRole('dialog', { name: 'ตู้เสื้อผ้า' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'เพศตัวละคร' })).toHaveValue('male');
    const accessoryPicker = screen.getByRole('combobox', {
      name: 'เครื่องประดับ',
    });
    fireEvent.change(accessoryPicker, { target: { value: 'gold-lotus' } });
    expect(accessoryPicker).toHaveValue('gold-lotus');
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));

    // Open SettingsPanel, change graphics quality, and reset game
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
        screen.getByRole('heading', { level: 1, name: /คืนเพ็ญของเราสองคน/i })
      ).toBeInTheDocument();
    });
    fetchSpy.mockRestore();
  });
});
