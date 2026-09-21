# Drive Tracker 💽

A modern self-hosted hard drive & SSD inventory manager, CrystalDiskInfo SMART parser, and warranty tracker designed specifically for home labs, NAS storage servers (TrueNAS, Unraid, Proxmox), and Portainer/Docker environments.

---

## 🌟 Core Features

### 1. Drive Inventory & Identification
- **Custom Assigned ID**: Edit drive numbers or custom tags (e.g. `DRV-01`, `Bay-3-Top`) to match physical drive caddies, labels, or sticky markers.
- **Serial Number Indexing**: Indexed search by manufacturer serial number with 1-click clipboard copy.
- **Hardware Specs**: Model, total capacity in GB/TB, form factor (`3.5" HDD`, `2.5" SSD`, `M.2 NVMe`, `SAS HDD`), interface, operating status, and custom notes.

### 2. Purchase & Warranty Tracking
- **Vendor & Order Info**: Record retailer/vendor names, purchase dates, order numbers, and purchase price.
- **Warranty Calculation**: Automatic calculation of exact warranty expiration dates from warranty duration in months, with live countdown badges (`Active`, `Expiring Soon`, `Expired`).
- **Initial State Snapshot**: Logs initial power-on hours (POH) and power-on counts (POC) on the day of delivery/shucking, calculating lifetime wear added under your ownership.

### 3. Receipt & Document Storage
- **Multi-Format Uploads**: Direct upload support for PDF invoices as well as photos of paper receipts (PNG, JPG, WEBP).
- **Persistent Storage**: Saved directly to persistent volume storage (`/app/uploads` or `./uploads`) and mapped directly to the drive profile for single-click retrieval and browser preview.

### 4. CrystalDiskInfo Parser & SMART Logging
- **Raw Text Parsing**: Paste raw output directly from CrystalDiskInfo (`Edit` &rarr; `Copy` or text logs).
- **Automatic Data Extraction**: Robust regular expression extraction for:
  - Power-On Hours (POH)
  - Power-On Count (POC)
  - Operating Temperature in °C and °F
  - Overall Health Status (`Good`, `Caution`, `Bad`) & health percentage
  - Host Reads / Writes (GB/TB)
  - S.M.A.R.T. attribute table snapshot (Reallocated Sectors, Current Pending Sectors, Uncorrectable, etc.)
  - Early degradation warning alerts
- **Interactive Visual Trend Graphs**: Interactive temperature trends over time (with 45°C safe warning threshold) and Power-On Hours progression curves.

### 5. Deployment & Automation Infrastructure (Portainer & Docker)
- **Containerized Deployment**: SQLite database with persistent data volumes (`/app/data` for database, `/app/uploads` for receipts).
- **Portainer CI/CD Webhook Integration**: Deploy as a Portainer Stack with automatic updates whenever new code is pushed to your Git repository (`main` branch).
- **Portable JSON Backup & Restore**: Export full database or restore with 1 click.

---

## 🚀 Portainer Deployment

### Option A: Portainer Stack via Web Editor (Fastest)

1. Open Portainer &rarr; **Stacks** &rarr; **+ Add stack**.
2. Name the stack: `drive-tracker`.
3. Paste the following into the web editor:

```yaml
version: '3.8'

services:
  drive-tracker:
    build:
      context: https://github.com/EdwardK9/drive-tracker.git#main
    container_name: drive-tracker
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/app/data
      - UPLOADS_DIR=/app/uploads
    volumes:
      - drive_tracker_data:/app/data
      - drive_tracker_uploads:/app/uploads
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/stats || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  drive_tracker_data:
    name: drive_tracker_data
  drive_tracker_uploads:
    name: drive_tracker_uploads
```

4. Click **Deploy the stack**. Access Drive Tracker at `http://<your-server-ip>:3000`.

---

### Option B: Portainer Stack via Git Repository with Automatic Webhook

1. In Portainer, go to **Stacks** &rarr; **Add stack**.
2. Select **Repository**.
3. **Repository URL**: `https://github.com/EdwardK9/drive-tracker.git`
4. **Repository reference**: `refs/heads/main`
5. **Compose path**: `docker-compose.yml`
6. Toggle **Automatic updates** to **ON** (Webhook).
7. Copy the generated Webhook URL.
8. In your GitHub repository:
   - Go to **Settings** &rarr; **Webhooks** &rarr; **Add webhook**.
   - Paste the Portainer Webhook URL into **Payload URL**.
   - Set **Content type** to `application/json`.
   - Select **Just the push event**.
9. Whenever you push new commits to GitHub, Portainer will automatically pull and redeploy the container!

---

## 🛠️ Local Development

To run locally without Docker:

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Build for production
npm run build

# 4. Run production server
npm run start
```

Default storage paths in development:
- Database: `./data/drives.db`
- Uploads: `./uploads`

---

## 🔒 Persistent Volumes

| Container Path | Host / Named Volume | Description |
| :--- | :--- | :--- |
| `/app/data` | `drive_tracker_data` | SQLite database file (`drives.db`) using WAL journal mode. |
| `/app/uploads` | `drive_tracker_uploads` | Uploaded PDF invoices and receipt images. |

---

## 📄 License
MIT License
