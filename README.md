# คืนเพ็ญริมน้ำ — Loy Krathong Couple Festival (MVP)

เกมเว็บแนว Top-Down 2D Romantic Open-World เทศกาลลอยกระทงสำหรับคู่รัก (Single-Device Local Co-op / Pass-and-Play) รองรับมือถือตั้งแต่หน้าจอ `320px`–`430px+` จนถึงเดสก์ท็อป ทำงานแบบออฟไลน์เต็มรูปแบบหลังโหลดไฟล์ Static และพร้อม Deploy บน Render Static Site

## ความสามารถหลัก (MVP Features)

1. **ปรับแต่งตัวละครคู่รัก 2 คน (P1 & P2)**:
   - ตั้งชื่อ เลือกสีผิว ทรงผม สีผม และชุดไทยร่วมสมัย
   - **เลือกรูปใบหน้าจากเครื่อง (Local-Only)**: ตรวจสอบไฟล์รูปภาพ PNG/JPG/WebP/GIF ด้วย magic bytes และปรับขนาดลง Canvas ในเครื่องเท่านั้น (ไม่มีการอัปโหลดหรือส่งเครือข่าย) บันทึกเป็น `Blob` ใน `IndexedDB` และ fallback เป็นตัวละคร SVG/Canvas อัตโนมัติหากไม่มีรูปหรือไฟล์ไม่ถูกต้อง
   - ข้อมูลทั้งหมดเก็บใน `localStorage` + `IndexedDB` พร้อมปุ่ม **รีเซ็ตข้อมูลทั้งหมด**
2. **แผนที่เทศกาลริมน้ำ (Phaser 3 Top-Down Open-World)**:
   - เดินสำรวจ 5 โซน: ลานโคมยี่เป็ง, ตลาดริมคลอง (ป้าบัว/ลุงมั่น), สวนหิ่งห้อย & ศาลาคู่รัก, โต๊ะประดิษฐ์กระทง และท่าน้ำแสงจันทร์
   - ควบคุมได้ทั้ง **จอยสติ๊กสัมผัส**, **ปุ่ม D-pad 4 ทิศทาง (44px+)**, และ **คีย์บอร์ด (`WASD` สำหรับ P1, `Arrow Keys` สำหรับ P2, `E` เพื่อโต้ตอบ)** พร้อมโหมด **เดินคู่กัน / แยกเดินอิสระ**
3. **ภารกิจร่วมกัน + มินิเกม 3 ด่านต่อเนื่องก่อนปล่อยกระทง**:
   - เก็บวัสดุ 3 อย่างจาก NPC และสวนดอกบัว
   - ผ่านมินิเกม 3 ด่านต่อเนื่องที่โต๊ะประดิษฐ์กระทง:
     1. **ด่าน 1 — คัดวัสดุตามสูตร**: จับเวลาเลือกวัตถุดิบ 4 ชิ้นจากถาด 8 ชิ้น (รองรับ Tap + Keyboard)
     2. **ด่าน 2 — ประกอบกระทงตามลำดับชั้น**: เรียงชิ้นส่วน 1→4 ด้วยการแตะหรือลากวาง (Drag/Tap Sequence + Keyboard)
     3. **ด่าน 3 — ประดับแสงตามจังหวะ**: แตะให้ตรงโซนสีทอง 5 จังหวะ (รองรับ Space/Tap และปรับเป็นจังหวะช้าชัดเจนในโหมด Reduced Motion)
   - แต่ละด่านมีสถานะผ่าน/ไม่ผ่านและปุ่มเล่นซ้ำ คะแนนรวมกำหนดระดับคุณภาพกระทง (`เรียบง่ายจริงใจ`, `งดงามอบอุ่น`, `วิจิตรแสงจันทร์`) ทั้งแสง ออร่า และจำนวนกลีบดอกไม้
4. **พิธีปล่อยกระทงที่ท่าน้ำและผลลัพธ์ในโลกจริง**:
   - ปล่อยกระทงลงสู่แม่น้ำแสงจันทร์พร้อมการ์ดความทรงจำของคู่รัก กระทงที่ปล่อยจะลอยปรากฏจริงบนผิวน้ำในฉาก Phaser และสามารถประดิษฐ์ใบใหม่ต่อได้
5. **Accessibility & Offline-First**:
   - ปุ่มแตะ `>= 44px` (`48px` บนจอสัมผัส), โฟกัสคีย์บอร์ดชัด (`:focus-visible`), Native `<dialog>`, Live regions (`aria-live`), และโหมด `prefers-reduced-motion` (ปรับได้ทั้งจากระบบและในเกม)

---

## โครงสร้างสถาปัตยกรรม

- `src/domain/`: `types.ts`, `worldMap.ts`, `minigames.ts`, `reducer.ts`, `customizationCatalog.ts` — pure TypeScript domain state & collision/quest/minigame rules (ไม่ผูกกับ DOM หรือ Phaser)
- `src/persistence/`: `storage.ts` — `localStorage` + `IndexedDB` portrait `Blob` storage และ local image validation/resizing
- `src/game/`: `FestivalScene.ts`, `textures.ts`, `sound.ts` — Phaser 3 rendering & procedural Canvas2D textures
- `src/components/`: `GameShell.tsx`, `SetupScreen.tsx`, `FestivalHud.tsx`, `TouchControls.tsx`, `MinigameSuite.tsx`, `InteractionModal.tsx`, `AvatarPreview.tsx`, `KrathongIllustration.tsx`

---

## การรันในเครื่อง (Local Development)

ต้องมี Node.js 20+ และ npm

```bash
npm ci
npm run dev
```

เปิดเบราว์เซอร์ไปที่ URL ที่ Vite แสดง (เช่น `http://localhost:5173`)

### คำสั่งตรวจสอบและ Build

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

---

## ขั้นตอน Deploy บน Render (Static Site)

โปรเจกต์นี้มาพร้อมไฟล์ [`render.yaml`](render.yaml) สำหรับ Render Static Site:

1. เชื่อมต่อ Repository บน [Render Dashboard](https://dashboard.render.com) แล้วเลือก **New → Static Site** (หรือ Blueprint จาก `render.yaml`)
2. ตั้งค่า Build & Publish:
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
3. ตั้งค่า Rewrite Rule สำหรับ SPA:
   - **Source**: `/*` → **Destination**: `/index.html` (`Action: Rewrite`)
4. กด Deploy — แอปทำงานแบบ Static 100% ไม่ต้องใช้ Environment Variables หรือ Backend Server