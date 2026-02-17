# คู่มือพาใช้งานจริง: ย้ายจาก Vercel ไป VPS (Hostinger + Coolify + Neon)

อัปเดตล่าสุด: 2026-02-17

เอกสารนี้ออกแบบให้ทำตามทีละขั้นและใช้งานจริงได้ทันทีสำหรับโปรเจกต์นี้

## 1) สรุปเป้าหมาย

- ย้ายระบบ Web/API จาก Vercel ไป Hostinger VPS
- รัน Worker สำหรับ MP4 conversion บน VPS ตลอดเวลา
- ใช้ Neon เป็น PostgreSQL และ Cloudflare R2 เป็น object storage
- ใช้ Coolify เป็น Web Management หลัก

## 2) โหมดการติดตั้งที่แนะนำ

- OS: Ubuntu Server 24.04 LTS
- VPS: Hostinger KVM 8 (หรืออย่างน้อย 4 vCPU/16 GB RAM หากโหลดไม่สูง)
- Web management: Coolify

## 3) เตรียมก่อนเริ่ม

## 3.1 ในเครื่อง local

```bash
cd /path/to/media-storage-platform
cp .env.production.example .env.production
```

กรอกค่าให้ครบใน `.env.production`

## 3.2 ดึงค่า env ปัจจุบันจาก Vercel

```bash
vercel login
vercel link
vercel env pull .env.vercel.production --environment=production
```

จากนั้น merge ค่าเข้า `.env.production` โดยตรวจว่ามีคีย์สำคัญครบ:
- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon direct)
- `JWT_SECRET`
- `R2_*`
- `NEXT_PUBLIC_APP_URL`
- `TRANSCODE_MODE=worker`

## 4) เตรียม VPS จริง

SSH เข้า VPS แล้วรัน:

```bash
sudo -i
cd /opt
# clone repo เฉพาะ production branch ที่ใช้งานจริง
# ตัวอย่าง:
# git clone https://github.com/7LS-SS1/media-storage-platform.git
# cd media-storage-platform
```

รัน bootstrap script:

```bash
bash scripts/deploy/bootstrap_ubuntu_vps.sh
```

สคริปต์นี้ทำ:
- อัปเดตแพ็กเกจ
- ติดตั้ง Docker / Docker Compose
- เปิด firewall พื้นฐาน
- เปิด fail2ban
- ติดตั้ง ffmpeg

## 5) ติดตั้ง Coolify (แนะนำ)

บน VPS รัน:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

จากนั้นเข้า UI ของ Coolify และทำตามลำดับนี้:

1. เชื่อม Git provider (GitHub)
2. สร้าง Project ใหม่
3. สร้าง Application 2 ตัวจาก repo เดียวกัน

Application A: `media-storage-web`
- Dockerfile path: `Dockerfile`
- Build target: `web`
- Port: `3000`
- Domain: `app.yourdomain.com`

Application B: `media-storage-worker`
- Dockerfile path: `Dockerfile`
- Build target: `worker`
- ไม่ต้องเปิด public domain

ตั้ง Environment Variables ทั้งสอง app โดยใช้ค่าเดียวกับ `.env.production`

ค่าที่เน้นสำหรับ worker:
- `TRANSCODE_MODE=worker`
- `FFMPEG_PATH=/usr/bin/ffmpeg`
- `FFPROBE_PATH=/usr/bin/ffprobe`
- `TRANSCODE_TMP_DIR=/tmp/transcode`

## 6) รัน migration ฐานข้อมูล (ครั้งแรกก่อนเปิดจริง)

วิธี CLI ในเซิร์ฟเวอร์ (กรณี deploy แบบ Docker Compose หรือ shell บน host):

```bash
cd /opt/media-storage-platform
bash scripts/deploy/migrate_production.sh
```

หมายเหตุ:
- สคริปต์นี้จะใช้ `DIRECT_URL` ใน `.env.production`
- Prisma schema ของโปรเจกต์อ้าง `DATABASE_URL` เป็นหลัก จึงต้อง override ตอน migrate

## 7) เปิดระบบจริง (ทางเลือก)

## 7.1 เปิดผ่าน Coolify (แนะนำ)
- กด Deploy ทั้ง `web` และ `worker`
- เช็ก logs ว่า `worker` ทำงานต่อเนื่อง

## 7.2 เปิดผ่าน Docker Compose (fallback)

```bash
cd /opt/media-storage-platform
bash scripts/deploy/deploy_production_stack.sh
```

ไฟล์ที่ใช้:
- `docker-compose.production.yml`
- `.env.production`

## 8) ทดสอบหลัง deploy

1. เปิดหน้าเว็บหลักได้
2. Login admin ได้
3. เรียกหน้า video list ได้
4. Upload คลิปใหม่ได้
5. กด Retranscode แล้วสถานะเปลี่ยนเป็น `PROCESSING`
6. Worker แปลงเสร็จและสถานะเปลี่ยนเป็น `READY`
7. เล่น MP4 ได้จริง

## 9) Cutover จาก Vercel

1. ลด DNS TTL ก่อน cutover (เช่น 60-300)
2. ตรวจระบบ VPS ผ่านครบทุกข้อในข้อ 8
3. เปลี่ยน DNS ไป VPS/Coolify ingress
4. เฝ้าระวัง 72 ชั่วโมงแรก

Rollback:
- หาก error สูง/ระบบล่ม ให้ชี้ DNS กลับ Vercel ทันที

## 10) ไฟล์ที่ใช้ในโปรเจกต์นี้

- `Dockerfile` (multi-target: `web`, `worker`)
- `docker-compose.production.yml`
- `.env.production.example`
- `scripts/deploy/bootstrap_ubuntu_vps.sh`
- `scripts/deploy/migrate_production.sh`
- `scripts/deploy/deploy_production_stack.sh`

## 11) จุดสำคัญสำหรับ MP4 conversion

- โปรเจกต์นี้ต้องมี worker process ทำงานต่อเนื่อง
- บน production ห้ามใช้ inline transcode
- หาก worker ไม่รัน งานจะค้างที่ `PROCESSING` และ `0%`
