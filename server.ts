import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db, initDatabase, DATA_DIR } from './server/db.js';
import { parseCrystalDiskInfo } from './server/crystalDiskParser.js';
import { parseCrystalDiskScreenshot } from './server/crystalDiskImageParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema
initDatabase();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${cleanName}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit for high-res invoices / PDFs
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads serving
app.use('/uploads', express.static(UPLOADS_DIR));

// App version endpoint
app.get('/api/version', (_req, res) => {
  res.json({
    name: 'Drive Tracker',
    version: '1.2.0',
    updatedAt: '2026-09-21',
  });
});

// Helper: Calculate warranty expiration date
function calculateWarrantyExpiry(purchaseDateStr: string, months: number): string {
  if (!purchaseDateStr) return '';
  const pDate = new Date(purchaseDateStr);
  if (isNaN(pDate.getTime())) return '';
  pDate.setMonth(pDate.getMonth() + months);
  return pDate.toISOString().split('T')[0];
}

// Helper: Get warranty status
function getWarrantyStatus(warrantyExpires?: string | null) {
  if (!warrantyExpires) {
    return { status: 'none', daysLeft: null, label: 'No Warranty' };
  }
  const exp = new Date(warrantyExpires);
  if (isNaN(exp.getTime())) {
    return { status: 'none', daysLeft: null, label: 'Invalid' };
  }
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'expired', daysLeft: diffDays, label: `Expired ${Math.abs(diffDays)}d ago` };
  } else if (diffDays <= 60) {
    return { status: 'expiring_soon', daysLeft: diffDays, label: `Expiring soon (${diffDays}d left)` };
  } else {
    return { status: 'active', daysLeft: diffDays, label: `${diffDays}d remaining` };
  }
}

function calculateDriveAgeAndRisk(
  manufactureDateStr: string | null | undefined,
  currentPoh: number,
  healthStatus: string = 'Good',
  smartAttributes: any[] = []
) {
  // Check for critical SMART attributes (reallocated or pending sectors)
  const reallocated = smartAttributes.find((a: any) => a.id === '05' || a.name?.toLowerCase().includes('reallocated'));
  const pending = smartAttributes.find((a: any) => a.id === 'C5' || a.name?.toLowerCase().includes('pending'));
  const hasBadSectors = (reallocated && parseInt(reallocated.rawValue || '0', 16) > 0) ||
                        (pending && parseInt(pending.rawValue || '0', 16) > 0);

  // 1. RUNTIME WEAR (Decoupled & strictly based on active mechanical Power-On Hours)
  // Baseline: 43,800 POH (5 years of continuous 24/7 spinning)
  let runtimePhase: 'burn_in' | 'prime' | 'mature' | 'wear_out' = 'prime';
  let runtimePhaseLabel = 'Prime Operational Phase (2k – 30k hrs)';
  let runtimeProgress = 25; // 0 to 100 on standard 5-year 43,800 POH baseline
  const equivalent247Years = +(currentPoh / 8760).toFixed(1);
  let runtimeDescription = '';

  if (currentPoh < 2000) {
    runtimePhase = 'burn_in';
    runtimePhaseLabel = 'Infant / Burn-in (<2,000 hrs)';
    runtimeProgress = Math.min(15, Math.round((currentPoh / 2000) * 15));
    runtimeDescription = `Only ${currentPoh.toLocaleString()} power-on hours logged. Manufacturing defects typically surface during early burn-in hours. Extended parity scrubs recommended.`;
  } else if (currentPoh >= 43800) {
    runtimePhase = 'wear_out';
    runtimePhaseLabel = 'High-Hour Wear-out Zone (>43,800 hrs)';
    runtimeProgress = Math.min(100, 85 + Math.round(((currentPoh - 43800) / 20000) * 15));
    runtimeDescription = `Exceeded 43,800 active operational hours (~5.0+ years of 24/7 spinning). Spindle bearing wear and actuator fatigue are elevated. Maintain standby replacement drives.`;
  } else if (currentPoh >= 30000) {
    runtimePhase = 'mature';
    runtimePhaseLabel = 'Mature Operating Phase (30k – 43.8k hrs)';
    runtimeProgress = 65 + Math.round(((currentPoh - 30000) / 13800) * 20);
    runtimeDescription = `${currentPoh.toLocaleString()} hours active runtime (~${equivalent247Years} yrs continuous). Normal enterprise wear progression; keep monthly parity scrubs active.`;
  } else {
    runtimePhase = 'prime';
    runtimePhaseLabel = 'Prime Operating Phase (2k – 30k hrs)';
    runtimeProgress = 15 + Math.round(((currentPoh - 2000) / 28000) * 50);
    runtimeDescription = `${currentPoh.toLocaleString()} hours logged (~${equivalent247Years} yrs continuous 24/7 spinning). Drive is operating in the statistical sweet spot with the lowest annualized failure rates (<1.0%).`;
  }

  // 2. CALENDAR AGE & DUTY CYCLE (Physical age since factory manufacture)
  let ageInfo = null;
  if (manufactureDateStr) {
    const mfgDate = new Date(manufactureDateStr);
    if (!isNaN(mfgDate.getTime())) {
      const now = new Date();
      const diffMs = now.getTime() - mfgDate.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const totalCalendarHours = diffDays * 24;
      const ageYears = +(diffDays / 365.25).toFixed(1);
      const ageMonths = Math.floor(diffDays / 30.4375);

      const yearsPart = Math.floor(ageMonths / 12);
      const monthsPart = ageMonths % 12;
      const formattedAge =
        yearsPart > 0
          ? `${yearsPart} yr${yearsPart > 1 ? 's' : ''}${monthsPart > 0 ? `, ${monthsPart} mo${monthsPart > 1 ? 's' : ''}` : ''}`
          : `${monthsPart} month${monthsPart === 1 ? '' : 's'}`;

      const dutyCyclePercent =
        totalCalendarHours > 0
          ? Math.min(100, Math.round((currentPoh / totalCalendarHours) * 100))
          : 100;

      let shelfProfile = 'Standard Duty';
      let shelfAdvice = '';

      if (dutyCyclePercent <= 25 && ageYears >= 2.5) {
        shelfProfile = 'Cold Storage / Low-Duty Spare';
        shelfAdvice = `Low Duty Cycle (${dutyCyclePercent}% Active) — Drive spent ~${100 - dutyCyclePercent}% of its calendar life powered off or in storage. Because active runtime is only ${currentPoh.toLocaleString()} hrs, mechanical spindle wear is minimal despite the ${formattedAge} calendar age. Standard advice: run monthly parity scrubs and keep regular backups.`;
      } else if (dutyCyclePercent >= 75) {
        shelfProfile = 'Continuous 24/7 Server Array';
        shelfAdvice = `High Duty Cycle (${dutyCyclePercent}% Active) — Drive ran almost continuously since factory manufacture. Spindle runtime directly tracks calendar age.`;
      } else {
        shelfProfile = 'Intermittent / Mixed Workload';
        shelfAdvice = `Moderate Duty Cycle (${dutyCyclePercent}% Active) — Mixed operational history between active arrays and powered-off storage.`;
      }

      ageInfo = {
        manufactureDate: manufactureDateStr,
        ageYears,
        ageMonths,
        formattedAge,
        totalCalendarHours,
        dutyCyclePercent,
        shelfProfile,
        shelfAdvice
      };
    }
  }

  // 3. OVERALL RELIABILITY & FAILURE RISK ASSESSMENT
  let riskLevel: 'low' | 'moderate' | 'elevated' | 'critical' = 'low';
  let riskTitle = 'Prime Reliability Window';
  let riskDescription = runtimeDescription;

  if (hasBadSectors || healthStatus === 'Bad') {
    riskLevel = 'critical';
    riskTitle = 'Critical - Sector Reallocation Detected';
    riskDescription = 'Drive has sector reallocation or critical SMART warnings. Immediate replacement and data migration strongly recommended.';
  } else if (healthStatus === 'Caution') {
    riskLevel = 'elevated';
    riskTitle = 'Caution - SMART Warning';
    riskDescription = 'Drive SMART state is flagged with caution. Back up data immediately and monitor parity logs.';
  } else if (runtimePhase === 'wear_out') {
    riskLevel = 'elevated';
    riskTitle = 'High Operating Hours (>43,800 hrs)';
    riskDescription = 'Drive has accumulated over 43,800 hours of active mechanical runtime. Prepare a cold standby spare drive.';
  } else if (runtimePhase === 'burn_in') {
    riskLevel = 'moderate';
    riskTitle = 'Early Burn-in Period';
    riskDescription = 'Early operational hours (<2,000 hrs). Run burn-in tests and ensure initial parity sync succeeds.';
  } else if (runtimePhase === 'mature') {
    riskLevel = 'moderate';
    riskTitle = 'Mature Operational Phase';
    riskDescription = 'Approaching standard 5-year enterprise operating baseline. Operating reliably with normal mechanical aging.';
  } else {
    // Prime operational
    riskLevel = 'low';
    riskTitle = 'Lowest Statistical Failure Rate';
    riskDescription = 'Drive is in the optimal bathtub curve sweet spot with low active hours and <1% annual historical failure rates.';
  }

  return {
    age_info: ageInfo,
    risk_assessment: {
      phase: runtimePhase,
      phaseLabel: runtimePhaseLabel,
      riskLevel,
      riskTitle,
      riskDescription,
      bathtubProgress: runtimeProgress,
      runtimeWear: {
        phase: runtimePhase,
        phaseLabel: runtimePhaseLabel,
        poh: currentPoh,
        progressPercent: runtimeProgress,
        equivalent247Years,
        description: runtimeDescription
      }
    }
  };
}

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Overview Statistics
app.get('/api/stats', (_req, res) => {
  try {
    const totalDrives = (db.prepare('SELECT COUNT(*) as count FROM drives').get() as { count: number }).count;
    const totalCapacity = (db.prepare('SELECT SUM(capacity_gb) as total FROM drives').get() as { total: number }).total || 0;
    const totalLogs = (db.prepare('SELECT COUNT(*) as count FROM crystal_disk_logs').get() as { count: number }).count;
    const totalReceipts = (db.prepare('SELECT COUNT(*) as count FROM drive_receipts').get() as { count: number }).count;

    // Latest health status per drive
    const drives = db.prepare('SELECT id, warranty_expires FROM drives').all() as { id: string; warranty_expires: string }[];
    
    let healthyCount = 0;
    let cautionCount = 0;
    let badCount = 0;
    let unknownCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let temps: number[] = [];

    for (const d of drives) {
      const latestLog = db.prepare(`
        SELECT health_status, temperature_c FROM crystal_disk_logs
        WHERE drive_id = ?
        ORDER BY log_date DESC, created_at DESC
        LIMIT 1
      `).get(d.id) as { health_status: string; temperature_c: number | null } | undefined;

      if (latestLog) {
        if (latestLog.health_status === 'Good') healthyCount++;
        else if (latestLog.health_status === 'Caution') cautionCount++;
        else if (latestLog.health_status === 'Bad') badCount++;
        else unknownCount++;

        if (latestLog.temperature_c !== null && latestLog.temperature_c > 0) {
          temps.push(latestLog.temperature_c);
        }
      } else {
        healthyCount++; // default newly added with no logs yet
      }

      const w = getWarrantyStatus(d.warranty_expires);
      if (w.status === 'expiring_soon') expiringSoonCount++;
      if (w.status === 'expired') expiredCount++;
    }

    const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;

    res.json({
      totalDrives,
      totalCapacityGB: totalCapacity,
      totalCapacityTB: (totalCapacity / 1000).toFixed(1),
      totalLogs,
      totalReceipts,
      health: {
        good: healthyCount,
        caution: cautionCount,
        bad: badCount,
        unknown: unknownCount
      },
      warranty: {
        expiringSoon: expiringSoonCount,
        expired: expiredCount
      },
      averageTemperatureC: avgTemp
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. List all drives
app.get('/api/drives', (_req, res) => {
  try {
    const drives = db.prepare(`
      SELECT * FROM drives
      ORDER BY 
        CASE WHEN custom_id IS NOT NULL AND custom_id != '' THEN custom_id ELSE id END ASC
    `).all() as any[];

    const enriched = drives.map(drive => {
      const latestLog = db.prepare(`
        SELECT id, log_date, health_status, health_percentage, temperature_c, temperature_f, power_on_hours, power_on_count, host_reads_gb, host_writes_gb, created_at
        FROM crystal_disk_logs
        WHERE drive_id = ?
        ORDER BY log_date DESC, created_at DESC
        LIMIT 1
      `).get(drive.id) as any;

      const logCount = (db.prepare('SELECT COUNT(*) as cnt FROM crystal_disk_logs WHERE drive_id = ?').get(drive.id) as { cnt: number }).cnt;
      const receiptCount = (db.prepare('SELECT COUNT(*) as cnt FROM drive_receipts WHERE drive_id = ?').get(drive.id) as { cnt: number }).cnt;
      const warrantyInfo = getWarrantyStatus(drive.warranty_expires);

      const currentPoh = latestLog?.power_on_hours ?? drive.initial_power_on_hours ?? 0;
      const { age_info, risk_assessment } = calculateDriveAgeAndRisk(
        drive.manufacture_date,
        currentPoh,
        latestLog?.health_status || 'Good'
      );

      return {
        ...drive,
        latest_log: latestLog || null,
        log_count: logCount,
        receipt_count: receiptCount,
        warranty_info: warrantyInfo,
        age_info,
        risk_assessment
      };
    });

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get single drive with logs & receipts
app.get('/api/drives/:id', (req, res) => {
  try {
    const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id) as any;
    if (!drive) {
      return res.status(404).json({ error: 'Drive not found' });
    }

    const logs = db.prepare(`
      SELECT * FROM crystal_disk_logs
      WHERE drive_id = ?
      ORDER BY log_date DESC, created_at DESC
    `).all(drive.id) as any[];

    const parsedLogs = logs.map(l => ({
      ...l,
      smart_attributes: l.smart_attributes_json ? JSON.parse(l.smart_attributes_json) : []
    }));

    const receipts = db.prepare(`
      SELECT * FROM drive_receipts
      WHERE drive_id = ?
      ORDER BY uploaded_at DESC
    `).all(drive.id);

    const warrantyInfo = getWarrantyStatus(drive.warranty_expires);

    const latestLog = parsedLogs[0];
    const currentPoh = latestLog?.power_on_hours ?? drive.initial_power_on_hours ?? 0;
    const { age_info, risk_assessment } = calculateDriveAgeAndRisk(
      drive.manufacture_date,
      currentPoh,
      latestLog?.health_status || 'Good',
      latestLog?.smart_attributes || []
    );

    res.json({
      ...drive,
      warranty_info: warrantyInfo,
      age_info,
      risk_assessment,
      logs: parsedLogs,
      receipts
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Create new drive
app.post('/api/drives', (req, res) => {
  try {
    const body = req.body;
    if (!body.serial_number || !body.model || !body.capacity_gb) {
      return res.status(400).json({ error: 'Serial number, model, and capacity (GB) are required.' });
    }

    const id = body.id || `drv-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    // Auto calculate warranty expiration if missing
    let warranty_expires = body.warranty_expires;
    if (!warranty_expires && body.purchase_date && body.warranty_months) {
      warranty_expires = calculateWarrantyExpiry(body.purchase_date, parseInt(body.warranty_months, 10));
    }

    // Auto-generate custom_id if empty (e.g. DRV-04)
    let custom_id = body.custom_id ? body.custom_id.trim() : '';
    if (!custom_id) {
      const count = (db.prepare('SELECT COUNT(*) as count FROM drives').get() as { count: number }).count;
      custom_id = `DRV-${String(count + 1).padStart(2, '0')}`;
    }

    const stmt = db.prepare(`
      INSERT INTO drives (
        id, custom_id, serial_number, model, capacity_gb, usable_capacity_gb, form_factor, interface,
        status, location, vendor, manufacture_date, purchase_date, order_number, purchase_price, currency,
        warranty_months, warranty_expires, initial_power_on_hours, initial_power_on_count,
        notes, created_at, updated_at
      ) VALUES (
        @id, @custom_id, @serial_number, @model, @capacity_gb, @usable_capacity_gb, @form_factor, @interface,
        @status, @location, @vendor, @manufacture_date, @purchase_date, @order_number, @purchase_price, @currency,
        @warranty_months, @warranty_expires, @initial_power_on_hours, @initial_power_on_count,
        @notes, @created_at, @updated_at
      )
    `);

    stmt.run({
      id,
      custom_id,
      serial_number: body.serial_number.trim(),
      model: body.model.trim(),
      capacity_gb: parseInt(body.capacity_gb, 10),
      usable_capacity_gb: body.usable_capacity_gb ? parseInt(body.usable_capacity_gb, 10) : null,
      form_factor: body.form_factor || '3.5" HDD',
      interface: body.interface || 'SATA III',
      status: body.status || 'Active',
      location: body.location || 'Storage',
      vendor: body.vendor ? body.vendor.trim() : null,
      manufacture_date: body.manufacture_date ? body.manufacture_date.trim() : null,
      purchase_date: body.purchase_date || null,
      order_number: body.order_number ? body.order_number.trim() : null,
      purchase_price: body.purchase_price ? parseFloat(body.purchase_price) : null,
      currency: body.currency || 'USD',
      warranty_months: body.warranty_months ? parseInt(body.warranty_months, 10) : 36,
      warranty_expires: warranty_expires || null,
      initial_power_on_hours: body.initial_power_on_hours ? parseInt(body.initial_power_on_hours, 10) : 0,
      initial_power_on_count: body.initial_power_on_count ? parseInt(body.initial_power_on_count, 10) : 0,
      notes: body.notes ? body.notes.trim() : null,
      created_at: now,
      updated_at: now
    });

    const created = db.prepare('SELECT * FROM drives WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed: drives.serial_number')) {
      return res.status(409).json({ error: 'A drive with this Serial Number already exists in your inventory.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 4b. Batch Create/Import Drives from Excel/Sheets
app.post('/api/drives/batch', (req, res) => {
  try {
    const drivesArray = req.body;
    if (!Array.isArray(drivesArray)) {
      return res.status(400).json({ error: 'Payload must be a JSON array of drives.' });
    }

    const transaction = db.transaction((arr: any[]) => {
      const results: any[] = [];
      const errors: string[] = [];

      const insertDriveStmt = db.prepare(`
        INSERT INTO drives (
          id, custom_id, serial_number, model, capacity_gb, usable_capacity_gb, form_factor, interface,
          status, location, vendor, manufacture_date, purchase_date, order_number, purchase_price, currency,
          warranty_months, warranty_expires, initial_power_on_hours, initial_power_on_count,
          notes, created_at, updated_at
        ) VALUES (
          @id, @custom_id, @serial_number, @model, @capacity_gb, @usable_capacity_gb, @form_factor, @interface,
          @status, @location, @vendor, @manufacture_date, @purchase_date, @order_number, @purchase_price, @currency,
          @warranty_months, @warranty_expires, @initial_power_on_hours, @initial_power_on_count,
          @notes, @created_at, @updated_at
        )
      `);

      const insertLogStmt = db.prepare(`
        INSERT INTO crystal_disk_logs (
          id, drive_id, log_date, health_status, health_percentage, temperature_c,
          temperature_f, power_on_hours, power_on_count, host_reads_gb, host_writes_gb,
          transfer_mode, raw_crystal_text, smart_attributes_json, log_notes, created_at
        ) VALUES (
          @id, @drive_id, @log_date, @health_status, @health_percentage, @temperature_c,
          @temperature_f, @power_on_hours, @power_on_count, @host_reads_gb, @host_writes_gb,
          @transfer_mode, @raw_crystal_text, @smart_attributes_json, @log_notes, @created_at
        )
      `);

      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item.serial_number || !item.model || !item.capacity_gb) {
          errors.push(`Row ${i + 1}: Missing Serial Number, Model, or Capacity`);
          continue;
        }

        const cleanSerial = item.serial_number.trim().toUpperCase();

        // Check if serial number already exists to prevent crash
        const existing = db.prepare('SELECT id FROM drives WHERE UPPER(serial_number) = ?').get(cleanSerial);
        if (existing) {
          errors.push(`Row ${i + 1} (${cleanSerial}): A drive with this serial number already exists.`);
          continue;
        }

        const id = `drv-${crypto.randomBytes(6).toString('hex')}`;
        const now = new Date().toISOString();

        let warranty_expires = item.warranty_expires;
        if (!warranty_expires && item.purchase_date && item.warranty_months) {
          warranty_expires = calculateWarrantyExpiry(item.purchase_date, parseInt(item.warranty_months, 10));
        }

        let custom_id = item.custom_id ? item.custom_id.trim() : '';
        if (!custom_id) {
          const countResult = db.prepare('SELECT COUNT(*) as count FROM drives').get() as { count: number };
          custom_id = `DRV-${String(countResult.count + 1 + i).padStart(2, '0')}`;
        }

        try {
          insertDriveStmt.run({
            id,
            custom_id,
            serial_number: cleanSerial,
            model: item.model.trim(),
            capacity_gb: parseInt(item.capacity_gb, 10),
            usable_capacity_gb: item.usable_capacity_gb ? parseInt(item.usable_capacity_gb, 10) : null,
            form_factor: item.form_factor || '3.5" HDD',
            interface: item.interface || 'SATA III',
            status: item.status || 'Active',
            location: item.location || 'Storage',
            vendor: item.vendor ? item.vendor.trim() : null,
            manufacture_date: item.manufacture_date ? item.manufacture_date.trim() : null,
            purchase_date: item.purchase_date || null,
            order_number: item.order_number ? item.order_number.trim() : null,
            purchase_price: item.purchase_price ? parseFloat(item.purchase_price) : null,
            currency: item.currency || 'USD',
            warranty_months: item.warranty_months ? parseInt(item.warranty_months, 10) : 36,
            warranty_expires: warranty_expires || null,
            initial_power_on_hours: item.initial_power_on_hours ? parseInt(item.initial_power_on_hours, 10) : 0,
            initial_power_on_count: item.initial_power_on_count ? parseInt(item.initial_power_on_count, 10) : 0,
            notes: item.notes ? item.notes.trim() : null,
            created_at: now,
            updated_at: now
          });

          // Create baseline log if health / poh data is present
          const hasHealth = item.health_status && item.health_status !== 'Unknown';
          const hasPoh = item.initial_power_on_hours !== undefined && item.initial_power_on_hours !== null && item.initial_power_on_hours > 0;
          if (hasHealth || hasPoh) {
            const logId = `log-${crypto.randomBytes(6).toString('hex')}`;
            const logDate = item.purchase_date || now.split('T')[0];
            
            insertLogStmt.run({
              id: logId,
              drive_id: id,
              log_date: logDate,
              health_status: item.health_status || 'Good',
              health_percentage: item.health_percentage ? parseInt(item.health_percentage, 10) : (item.health_status === 'Good' ? 100 : null),
              temperature_c: null,
              temperature_f: null,
              power_on_hours: item.initial_power_on_hours ? parseInt(item.initial_power_on_hours, 10) : 0,
              power_on_count: item.initial_power_on_count ? parseInt(item.initial_power_on_count, 10) : 1,
              host_reads_gb: null,
              host_writes_gb: null,
              transfer_mode: null,
              raw_crystal_text: `Baseline imported from bulk table.\nLocation: ${item.location || 'Storage'}`,
              smart_attributes_json: JSON.stringify([]),
              log_notes: 'Initial state imported via Excel copy-paste table.',
              created_at: now
            });
          }

          results.push({ id, custom_id, serial_number: cleanSerial });
        } catch (err: any) {
          errors.push(`Row ${i + 1} (${cleanSerial}): ${err.message}`);
        }
      }

      return { results, errors };
    });

    const output = transaction(drivesArray);
    res.json({ success: true, results: output.results, errors: output.errors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Update existing drive
app.put('/api/drives/:id', (req, res) => {
  try {
    const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
    if (!drive) {
      return res.status(404).json({ error: 'Drive not found' });
    }

    const body = req.body;
    let warranty_expires = body.warranty_expires;
    if (!warranty_expires && body.purchase_date && body.warranty_months) {
      warranty_expires = calculateWarrantyExpiry(body.purchase_date, parseInt(body.warranty_months, 10));
    }

    const stmt = db.prepare(`
      UPDATE drives SET
        custom_id = @custom_id,
        serial_number = @serial_number,
        model = @model,
        capacity_gb = @capacity_gb,
        usable_capacity_gb = @usable_capacity_gb,
        form_factor = @form_factor,
        interface = @interface,
        status = @status,
        location = @location,
        vendor = @vendor,
        manufacture_date = @manufacture_date,
        purchase_date = @purchase_date,
        order_number = @order_number,
        purchase_price = @purchase_price,
        currency = @currency,
        warranty_months = @warranty_months,
        warranty_expires = @warranty_expires,
        initial_power_on_hours = @initial_power_on_hours,
        initial_power_on_count = @initial_power_on_count,
        notes = @notes,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id: req.params.id,
      custom_id: body.custom_id !== undefined ? body.custom_id.trim() : (drive as any).custom_id,
      serial_number: body.serial_number ? body.serial_number.trim() : (drive as any).serial_number,
      model: body.model ? body.model.trim() : (drive as any).model,
      capacity_gb: body.capacity_gb ? parseInt(body.capacity_gb, 10) : (drive as any).capacity_gb,
      usable_capacity_gb: body.usable_capacity_gb !== undefined ? (body.usable_capacity_gb ? parseInt(body.usable_capacity_gb, 10) : null) : (drive as any).usable_capacity_gb,
      form_factor: body.form_factor || (drive as any).form_factor,
      interface: body.interface || (drive as any).interface,
      status: body.status || (drive as any).status,
      location: body.location !== undefined ? body.location : (drive as any).location,
      vendor: body.vendor !== undefined ? body.vendor : (drive as any).vendor,
      manufacture_date: body.manufacture_date !== undefined ? (body.manufacture_date ? body.manufacture_date.trim() : null) : (drive as any).manufacture_date,
      purchase_date: body.purchase_date !== undefined ? body.purchase_date : (drive as any).purchase_date,
      order_number: body.order_number !== undefined ? body.order_number : (drive as any).order_number,
      purchase_price: body.purchase_price !== undefined ? parseFloat(body.purchase_price) : (drive as any).purchase_price,
      currency: body.currency || (drive as any).currency,
      warranty_months: body.warranty_months !== undefined ? parseInt(body.warranty_months, 10) : (drive as any).warranty_months,
      warranty_expires: warranty_expires !== undefined ? warranty_expires : (drive as any).warranty_expires,
      initial_power_on_hours: body.initial_power_on_hours !== undefined ? parseInt(body.initial_power_on_hours, 10) : (drive as any).initial_power_on_hours,
      initial_power_on_count: body.initial_power_on_count !== undefined ? parseInt(body.initial_power_on_count, 10) : (drive as any).initial_power_on_count,
      notes: body.notes !== undefined ? body.notes : (drive as any).notes,
      updated_at: new Date().toISOString()
    });

    const updated = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed: drives.serial_number')) {
      return res.status(409).json({ error: 'Another drive with this Serial Number already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete drive
app.delete('/api/drives/:id', (req, res) => {
  try {
    const receipts = db.prepare('SELECT filename FROM drive_receipts WHERE drive_id = ?').all(req.params.id) as { filename: string }[];
    
    // Delete files on disk
    for (const r of receipts) {
      const filePath = path.join(UPLOADS_DIR, r.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
    }

    db.prepare('DELETE FROM drives WHERE id = ?').run(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6b. Quick update manufacture date
app.patch('/api/drives/:id/manufacture-date', (req, res) => {
  try {
    const { manufacture_date } = req.body;
    const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
    if (!drive) {
      return res.status(404).json({ error: 'Drive not found' });
    }

    db.prepare(`
      UPDATE drives
      SET manufacture_date = ?, updated_at = ?
      WHERE id = ?
    `).run(manufacture_date ? manufacture_date.trim() : null, new Date().toISOString(), req.params.id);

    const updated = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6c. Bulk Import/Upsert of Drives and POH Logs
app.post('/api/drives/bulk', (req, res) => {
  try {
    const { importType, items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array.' });
    }

    let inserted = 0;
    let updated = 0;
    let logsInserted = 0;
    const failures: { item: any; reason: string }[] = [];
    const now = new Date().toISOString();

    const insertDriveStmt = db.prepare(`
      INSERT INTO drives (
        id, custom_id, serial_number, model, capacity_gb, usable_capacity_gb, form_factor, interface,
        status, location, vendor, manufacture_date, purchase_date, order_number, purchase_price, currency,
        warranty_months, warranty_expires, initial_power_on_hours, initial_power_on_count,
        notes, created_at, updated_at
      ) VALUES (
        @id, @custom_id, @serial_number, @model, @capacity_gb, @usable_capacity_gb, @form_factor, @interface,
        @status, @location, @vendor, @manufacture_date, @purchase_date, @order_number, @purchase_price, @currency,
        @warranty_months, @warranty_expires, @initial_power_on_hours, @initial_power_on_count,
        @notes, @created_at, @updated_at
      )
    `);

    const updateDriveStmt = db.prepare(`
      UPDATE drives SET
        custom_id = @custom_id,
        model = @model,
        capacity_gb = @capacity_gb,
        usable_capacity_gb = @usable_capacity_gb,
        form_factor = @form_factor,
        interface = @interface,
        status = @status,
        location = @location,
        vendor = @vendor,
        manufacture_date = @manufacture_date,
        purchase_date = @purchase_date,
        order_number = @order_number,
        purchase_price = @purchase_price,
        currency = @currency,
        warranty_months = @warranty_months,
        warranty_expires = @warranty_expires,
        initial_power_on_hours = @initial_power_on_hours,
        initial_power_on_count = @initial_power_on_count,
        notes = @notes,
        updated_at = @updated_at
      WHERE id = @id
    `);

    const insertLogStmt = db.prepare(`
      INSERT INTO crystal_disk_logs (
        id, drive_id, log_date, health_status, health_percentage, temperature_c,
        temperature_f, power_on_hours, power_on_count, host_reads_gb, host_writes_gb,
        transfer_mode, raw_crystal_text, smart_attributes_json, log_notes, created_at
      ) VALUES (
        @id, @drive_id, @log_date, @health_status, @health_percentage, @temperature_c,
        @temperature_f, @power_on_hours, @power_on_count, @host_reads_gb, @host_writes_gb,
        @transfer_mode, @raw_crystal_text, @smart_attributes_json, @log_notes, @created_at
      )
    `);

    // Helper: Calculate warranty expiration date
    function calculateWarrantyExpiry(purchaseDateStr: string, months: number): string | null {
      try {
        const d = new Date(purchaseDateStr);
        if (isNaN(d.getTime())) return null;
        d.setMonth(d.getMonth() + months);
        return d.toISOString().split('T')[0];
      } catch (e) {
        return null;
      }
    }

    // Wrap the import process in a fast SQLite transaction
    const transaction = db.transaction(() => {
      if (importType === 'drives') {
        for (const item of items) {
          try {
            const sn = item.serial_number ? item.serial_number.trim() : '';
            if (!sn) {
              failures.push({ item, reason: 'Missing Serial Number' });
              continue;
            }

            const model = item.model ? item.model.trim() : 'Unknown Model';
            const capacity_gb = parseInt(item.capacity_gb, 10) || 0;
            const usable_capacity_gb = item.usable_capacity_gb ? parseInt(item.usable_capacity_gb, 10) : null;

            // Check if drive with serial number exists
            const existing = db.prepare('SELECT * FROM drives WHERE LOWER(serial_number) = LOWER(?)').get(sn) as any;

            let warranty_expires = item.warranty_expires || null;
            if (!warranty_expires && item.purchase_date && item.warranty_months) {
              warranty_expires = calculateWarrantyExpiry(item.purchase_date, parseInt(item.warranty_months, 10));
            }

            if (existing) {
              updateDriveStmt.run({
                id: existing.id,
                custom_id: item.custom_id !== undefined ? item.custom_id.trim() : existing.custom_id,
                model: item.model ? item.model.trim() : existing.model,
                capacity_gb: capacity_gb || existing.capacity_gb,
                usable_capacity_gb: usable_capacity_gb !== null ? usable_capacity_gb : existing.usable_capacity_gb,
                form_factor: item.form_factor || existing.form_factor,
                interface: item.interface || existing.interface,
                status: item.status || existing.status,
                location: item.location || existing.location,
                vendor: item.vendor !== undefined ? item.vendor : existing.vendor,
                manufacture_date: item.manufacture_date !== undefined ? item.manufacture_date : existing.manufacture_date,
                purchase_date: item.purchase_date !== undefined ? item.purchase_date : existing.purchase_date,
                order_number: item.order_number !== undefined ? item.order_number : existing.order_number,
                purchase_price: item.purchase_price !== undefined ? parseFloat(item.purchase_price) : existing.purchase_price,
                currency: item.currency || existing.currency || 'USD',
                warranty_months: item.warranty_months !== undefined ? parseInt(item.warranty_months, 10) : existing.warranty_months,
                warranty_expires: warranty_expires || existing.warranty_expires,
                initial_power_on_hours: item.initial_power_on_hours !== undefined ? parseInt(item.initial_power_on_hours, 10) : existing.initial_power_on_hours,
                initial_power_on_count: item.initial_power_on_count !== undefined ? parseInt(item.initial_power_on_count, 10) : existing.initial_power_on_count,
                notes: item.notes !== undefined ? item.notes : existing.notes,
                updated_at: now
              });
              updated++;
            } else {
              const id = `drv-${crypto.randomBytes(6).toString('hex')}`;
              let custom_id = item.custom_id ? item.custom_id.trim() : '';
              if (!custom_id) {
                const count = (db.prepare('SELECT COUNT(*) as count FROM drives').get() as { count: number }).count;
                custom_id = `DRV-${String(count + 1 + inserted).padStart(2, '0')}`;
              }

              insertDriveStmt.run({
                id,
                custom_id,
                serial_number: sn,
                model,
                capacity_gb,
                usable_capacity_gb,
                form_factor: item.form_factor || '3.5" HDD',
                interface: item.interface || 'SATA III',
                status: item.status || 'Active',
                location: item.location || 'Storage',
                vendor: item.vendor ? item.vendor.trim() : null,
                manufacture_date: item.manufacture_date ? item.manufacture_date.trim() : null,
                purchase_date: item.purchase_date || null,
                order_number: item.order_number ? item.order_number.trim() : null,
                purchase_price: item.purchase_price ? parseFloat(item.purchase_price) : null,
                currency: item.currency || 'USD',
                warranty_months: item.warranty_months ? parseInt(item.warranty_months, 10) : 36,
                warranty_expires: warranty_expires,
                initial_power_on_hours: item.initial_power_on_hours ? parseInt(item.initial_power_on_hours, 10) : 0,
                initial_power_on_count: item.initial_power_on_count ? parseInt(item.initial_power_on_count, 10) : 0,
                notes: item.notes ? item.notes.trim() : null,
                created_at: now,
                updated_at: now
              });
              inserted++;
            }
          } catch (err: any) {
            failures.push({ item, reason: err.message });
          }
        }
      } else if (importType === 'poh') {
        for (const item of items) {
          try {
            const sn = item.serial_number ? item.serial_number.trim() : '';
            const customId = item.custom_id ? item.custom_id.trim() : '';

            if (!sn && !customId) {
              failures.push({ item, reason: 'Neither Serial Number nor HDD Name/ID was provided.' });
              continue;
            }

            // Find matching drive
            let drive: any = null;
            if (sn) {
              drive = db.prepare('SELECT * FROM drives WHERE LOWER(serial_number) = LOWER(?)').get(sn);
            }
            if (!drive && customId) {
              drive = db.prepare('SELECT * FROM drives WHERE LOWER(custom_id) = LOWER(?)').get(customId);
            }

            if (!drive) {
              failures.push({ item, reason: `No matching drive found for Serial: "${sn}" or ID: "${customId}"` });
              continue;
            }

            const logId = `log-${crypto.randomBytes(6).toString('hex')}`;
            const log_date = item.log_date || new Date().toISOString().split('T')[0];
            const power_on_hours = parseInt(item.power_on_hours, 10);
            const power_on_count = item.power_on_count ? parseInt(item.power_on_count, 10) : null;
            const health_status = item.health_status || 'Good';

            if (isNaN(power_on_hours)) {
              failures.push({ item, reason: 'Invalid or missing Power On Hours value.' });
              continue;
            }

            insertLogStmt.run({
              id: logId,
              drive_id: drive.id,
              log_date,
              health_status,
              health_percentage: item.health_percentage ? parseInt(item.health_percentage, 10) : null,
              temperature_c: item.temperature_c ? parseInt(item.temperature_c, 10) : null,
              temperature_f: item.temperature_f ? parseInt(item.temperature_f, 10) : null,
              power_on_hours,
              power_on_count,
              host_reads_gb: item.host_reads_gb ? parseFloat(item.host_reads_gb) : null,
              host_writes_gb: item.host_writes_gb ? parseFloat(item.host_writes_gb) : null,
              transfer_mode: item.transfer_mode || null,
              raw_crystal_text: item.raw_crystal_text || null,
              smart_attributes_json: JSON.stringify([]),
              log_notes: item.notes || 'Bulk imported Power-On Hours log.',
              created_at: now
            });
            logsInserted++;
          } catch (err: any) {
            failures.push({ item, reason: err.message });
          }
        }
      }
    });

    transaction();

    res.json({
      success: true,
      stats: {
        inserted,
        updated,
        logsInserted,
        failuresCount: failures.length,
        failures: failures.slice(0, 10) // Send top 10 failure reasons for debugging
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Parse CrystalDiskInfo text
app.post('/api/parse-crystaldiskinfo', (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'rawText string is required' });
    }

    const parsed = parseCrystalDiskInfo(rawText);

    // Try finding matching drive by serial number or model
    let matchedDrive: any = null;
    if (parsed.serialNumber) {
      matchedDrive = db.prepare('SELECT * FROM drives WHERE LOWER(serial_number) = LOWER(?)').get(parsed.serialNumber);
    }
    if (!matchedDrive && parsed.model) {
      // Fallback matching
      matchedDrive = db.prepare('SELECT * FROM drives WHERE LOWER(model) = LOWER(?)').get(parsed.model);
    }

    res.json({
      parsed,
      matchedDrive: matchedDrive || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7b. Parse CrystalDiskInfo Screenshot via Gemini Vision OCR
app.post('/api/parse-crystaldisk-image', upload.single('screenshot'), async (req, res) => {
  try {
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/png';

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype || 'image/png';
      // Clean up temporary upload file
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) { /* ignore */ }
    } else if (req.body.imageBase64) {
      const rawBase64 = req.body.imageBase64;
      const match = rawBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imageBuffer = Buffer.from(match[2], 'base64');
      } else {
        imageBuffer = Buffer.from(rawBase64, 'base64');
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({
        error: 'No image provided. Please upload a screenshot file or paste an image from clipboard.'
      });
    }

    const { parsed, rawText } = await parseCrystalDiskScreenshot(imageBuffer, mimeType);

    // Try finding matching drive by serial number or model
    let matchedDrive: any = null;
    if (parsed.serialNumber) {
      matchedDrive = db.prepare('SELECT * FROM drives WHERE LOWER(serial_number) = LOWER(?)').get(parsed.serialNumber);
    }
    if (!matchedDrive && parsed.model) {
      matchedDrive = db.prepare('SELECT * FROM drives WHERE LOWER(model) = LOWER(?)').get(parsed.model);
    }

    res.json({
      parsed,
      rawText,
      matchedDrive: matchedDrive || null
    });
  } catch (error: any) {
    console.error('Failed to parse CrystalDisk image:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze CrystalDisk screenshot'
    });
  }
});

// 8. Add CrystalDiskInfo Log to a Drive
app.post('/api/drives/:id/logs', (req, res) => {
  try {
    const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
    if (!drive) {
      return res.status(404).json({ error: 'Drive not found' });
    }

    const body = req.body;
    let parsed: any = null;
    if (body.raw_crystal_text) {
      parsed = parseCrystalDiskInfo(body.raw_crystal_text);
    }

    const id = `log-${crypto.randomBytes(6).toString('hex')}`;
    const log_date = body.log_date || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const health_status = body.health_status || parsed?.healthStatus || 'Good';
    const health_percentage = body.health_percentage ?? parsed?.healthPercentage ?? null;
    const temperature_c = body.temperature_c ?? parsed?.temperatureC ?? null;
    const temperature_f = body.temperature_f ?? parsed?.temperatureF ?? (temperature_c ? Math.round((temperature_c * 9) / 5 + 32) : null);
    const power_on_hours = body.power_on_hours ?? parsed?.powerOnHours ?? null;
    const power_on_count = body.power_on_count ?? parsed?.powerOnCount ?? null;
    const host_reads_gb = body.host_reads_gb ?? parsed?.hostReadsGB ?? null;
    const host_writes_gb = body.host_writes_gb ?? parsed?.hostWritesGB ?? null;
    const transfer_mode = body.transfer_mode || parsed?.transferMode || null;
    const raw_crystal_text = body.raw_crystal_text || null;
    const smart_attributes = body.smart_attributes || parsed?.smartAttributes || [];
    const log_notes = body.log_notes || null;

    db.prepare(`
      INSERT INTO crystal_disk_logs (
        id, drive_id, log_date, health_status, health_percentage, temperature_c,
        temperature_f, power_on_hours, power_on_count, host_reads_gb, host_writes_gb,
        transfer_mode, raw_crystal_text, smart_attributes_json, log_notes, created_at
      ) VALUES (
        @id, @drive_id, @log_date, @health_status, @health_percentage, @temperature_c,
        @temperature_f, @power_on_hours, @power_on_count, @host_reads_gb, @host_writes_gb,
        @transfer_mode, @raw_crystal_text, @smart_attributes_json, @log_notes, @created_at
      )
    `).run({
      id,
      drive_id: req.params.id,
      log_date,
      health_status,
      health_percentage,
      temperature_c,
      temperature_f,
      power_on_hours,
      power_on_count,
      host_reads_gb,
      host_writes_gb,
      transfer_mode,
      raw_crystal_text,
      smart_attributes_json: JSON.stringify(smart_attributes),
      log_notes,
      created_at: now
    });

    const createdLog = db.prepare('SELECT * FROM crystal_disk_logs WHERE id = ?').get(id) as any;
    res.status(201).json({
      ...createdLog,
      smart_attributes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Delete a log entry
app.delete('/api/logs/:logId', (req, res) => {
  try {
    db.prepare('DELETE FROM crystal_disk_logs WHERE id = ?').run(req.params.logId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Upload receipt / invoice file
app.post('/api/drives/:id/upload-receipt', upload.single('file'), (req, res) => {
  try {
    const drive = db.prepare('SELECT * FROM drives WHERE id = ?').get(req.params.id);
    if (!drive) {
      // Remove uploaded file if drive does not exist
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Drive not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const id = `rec-${crypto.randomBytes(6).toString('hex')}`;
    const label = req.body.label || req.file.originalname;

    db.prepare(`
      INSERT INTO drive_receipts (
        id, drive_id, filename, original_name, file_type, file_size, uploaded_at, label
      ) VALUES (
        @id, @drive_id, @filename, @original_name, @file_type, @file_size, @uploaded_at, @label
      )
    `).run({
      id,
      drive_id: req.params.id,
      filename: req.file.filename,
      original_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      uploaded_at: new Date().toISOString(),
      label: label.trim()
    });

    const created = db.prepare('SELECT * FROM drive_receipts WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Delete receipt file
app.delete('/api/receipts/:receiptId', (req, res) => {
  try {
    const receipt = db.prepare('SELECT * FROM drive_receipts WHERE id = ?').get(req.params.receiptId) as any;
    if (receipt) {
      const filePath = path.join(UPLOADS_DIR, receipt.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
      db.prepare('DELETE FROM drive_receipts WHERE id = ?').run(req.params.receiptId);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Backup Export (Full JSON)
app.get('/api/export', (_req, res) => {
  try {
    const drives = db.prepare('SELECT * FROM drives').all();
    const logs = db.prepare('SELECT * FROM crystal_disk_logs').all();
    const receipts = db.prepare('SELECT * FROM drive_receipts').all();

    const backup = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      drives,
      logs,
      receipts
    };

    res.setHeader('Content-Disposition', `attachment; filename="drive-tracker-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Backup Import
app.post('/api/import', (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.drives)) {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const insertDrive = db.prepare(`
      INSERT OR REPLACE INTO drives (
        id, custom_id, serial_number, model, capacity_gb, form_factor, interface,
        status, vendor, manufacture_date, purchase_date, order_number, purchase_price, currency,
        warranty_months, warranty_expires, initial_power_on_hours, initial_power_on_count,
        notes, created_at, updated_at
      ) VALUES (
        @id, @custom_id, @serial_number, @model, @capacity_gb, @form_factor, @interface,
        @status, @vendor, @manufacture_date, @purchase_date, @order_number, @purchase_price, @currency,
        @warranty_months, @warranty_expires, @initial_power_on_hours, @initial_power_on_count,
        @notes, @created_at, @updated_at
      )
    `);

    const insertLog = db.prepare(`
      INSERT OR REPLACE INTO crystal_disk_logs (
        id, drive_id, log_date, health_status, health_percentage, temperature_c,
        temperature_f, power_on_hours, power_on_count, host_reads_gb, host_writes_gb,
        transfer_mode, raw_crystal_text, smart_attributes_json, log_notes, created_at
      ) VALUES (
        @id, @drive_id, @log_date, @health_status, @health_percentage, @temperature_c,
        @temperature_f, @power_on_hours, @power_on_count, @host_reads_gb, @host_writes_gb,
        @transfer_mode, @raw_crystal_text, @smart_attributes_json, @log_notes, @created_at
      )
    `);

    db.transaction(() => {
      for (const d of data.drives) {
        insertDrive.run({
          ...d,
          manufacture_date: d.manufacture_date || null
        });
      }
      if (Array.isArray(data.logs)) {
        for (const l of data.logs) {
          insertLog.run(l);
        }
      }
    })();

    res.json({ success: true, message: `Imported ${data.drives.length} drives and ${data.logs?.length || 0} logs` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VITE / STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In development mode, attach Vite as middleware to Express
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Drive Tracker] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Drive Tracker] Data storage: ${DATA_DIR}`);
    console.log(`[Drive Tracker] Uploads storage: ${UPLOADS_DIR}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
