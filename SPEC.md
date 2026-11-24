# Loy Krathong MVP — SPEC & Acceptance Matrix

## ขอบเขตระบบ (Scope)
- **In Scope**: Single-device local co-op / pass-and-play (2 profiles), local-only face photo upload with fallback avatar, 2D top-down festival map (Phaser 3), collision & interactive spots, 3 sequential minigames before release, ceremony & keepsake state change, `localStorage` + `IndexedDB` persistence/reset, WCAG-friendly controls, `320px–430px+` mobile responsiveness, Render Static Site config.
- **Out of Scope**: Authentication, backend API, online multiplayer, external file uploads, analytics, paid/licensed external assets.

## เกณฑ์ตรวจรับ (Acceptance Checklist)
1. **Responsive Layout (`320px`, `360x800`, `430x932`, Desktop)**: ไม่มี horizontal scroll; touch targets `>= 44px`.
2. **Offline Start After Static Load**: ไม่มี runtime dependency ไปยัง CDN/API ภายนอก; assets ทั้งหมดสร้างแบบ procedural/inline SVG และ CSS system Thai font stack.
3. **2 Profiles Persist / Reload / Reset**: แก้ไขชื่อ สีผิว ทรงผม ชุด และรูปใบหน้าของ P1/P2 แล้ว reload กลับมาครบ และกดรีเซ็ตกลับค่าเริ่มต้นได้สะอาด.
4. **Local Photo Privacy & Fallback**: เลือกรูปใบหน้าในเครื่องต้องไม่เกิด network request; ไฟล์ไม่ใช่รูป/ไฟล์ว่าง/เกิน 10MB ต้องแสดงข้อความแจ้งและ fallback เป็น avatar.
5. **Deterministic Map & Quest Loop**:
   - Collision กั้นขอบแผนที่ แม่น้ำ และสิ่งปลูกสร้าง โดยเดินลงสะพานท่าน้ำได้
   - เก็บวัสดุ 3 อย่าง → ผ่านมินิเกม 3 ด่านต่อเนื่อง (Recipe, Assembly, Rhythm — มี pass/fail/retry และ keyboard fallback) → ประกอบกระทง → ทำพิธีที่ท่าน้ำ → กระทงปรากฏบนแม่น้ำและแสดงคุณภาพตามคะแนนมินิเกม
6. **Accessibility & Reduced Motion**: Labels, `<dialog>` modal focus management, keyboard controls (`WASD` / `Arrows` / `Tab` / `Enter` / `Space`), และลด animation/particle เมื่อเปิด `prefers-reduced-motion`.
7. **Verification Gates**: `npm run typecheck`, `npm run test`, `npm run build` ผ่านทั้งหมด.