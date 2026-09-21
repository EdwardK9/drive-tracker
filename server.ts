import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db, initDatabase, DATA_DIR } from './server/db.js';
import { parseCrystalDiskInfo } from './server/crystalDiskParser.js';

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
  if (!manufactureDateStr) {
    return {
      age_info: null,
      risk_assessment: null
    };
  }

  const mfgDate = new Date(manufactureDateStr);
  if (isNaN(mfgDate.getTime())) {
    return { age_info: null, risk_assessment: null };
  }

  const now = new Date();
  const diffMs = now.getTime() - mfgDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const totalCalendarHours = diffDays * 24;

  const ageYears = +(diffDays / 365.25).toFixed(1);
  const ageMonths = Math.floor(diffDays / 30.4375);

  let formattedAge = '';
  const yearsPart = Math.floor(ageMonths / 12);
  const monthsPart = ageMonths % 12;
  if (yearsPart > 0) {
    formattedAge = `${yearsPart} yr${yearsPart > 1 ? 's' : ''}${monthsPart > 0 ? `, ${monthsPart} mo${monthsPart > 1 ? 's' : ''}` : ''}`;
  } else {
    formattedAge = `${monthsPart} month${monthsPart === 1 ? '' : 's'}`;
  }

  // Active duty cycle (% of elapsed physical calendar hours spent powered on)
  const dutyCyclePercent = totalCalendarHours > 0
    ? Math.min(100, Math.round((currentPoh / totalCalendarHours) * 100))
    : 100;

  // Check for critical SMART attributes (reallocated or pending sectors)
  const reallocated = smartAttributes.find((a: any) => a.id === '05' || a.name?.toLowerCase().includes('reallocated'));
  const pending = smartAttributes.find((a: any) => a.id === 'C5' || a.name?.toLowerCase().includes('pending'));
  const hasBadSectors = (reallocated && parseInt(reallocated.rawValue || '0', 16) > 0) ||
                        (pending && parseInt(pending.rawValue || '0', 16) > 0);

  // Bathtub Curve & Risk Assessment
  let phase: 'burn_in' | 'prime' | 'mature' | 'wear_out' = 'prime';
  let phaseLabel = 'Prime Operational Phase';
  let riskLevel: 'low' | 'moderate' | 'elevated' | 'critical' = 'low';
  let riskTitle = 'Lowest Statistical Failure Rate';
  let riskDescription = 'Drive is in the optimal bathtub curve sweet spot with the lowest historical failure rates across enterprise fleet data.';
  let bathtubProgress = 35;

  if (ageYears < 0.35 || currentPoh < 2000) {
    phase = 'burn_in';
    phaseLabel = 'Infant / Burn-in Phase';
    bathtubProgress = Math.min(22, Math.round((currentPoh / 2000) * 22));
    riskLevel = 'moderate';
    riskTitle = 'Early Burn-in Period';
    riskDescription = 'Early life burn-in phase. Manufacturing defects typically surface during early operational hours. Run extended SMART tests and parity scrubs.';
  } else if (ageYears >= 5.0 || currentPoh >= 43800) {
    phase = 'wear_out';
    phaseLabel = 'Aging Wear-out Phase (>5 Yrs)';
    bathtubProgress = Math.min(100, 75 + Math.round(((ageYears - 5) / 3) * 25));
    riskLevel = 'elevated';
    riskTitle = 'Elevated Age Risk (>5 Years)';
    riskDescription = 'Beyond standard 5-year enterprise design life (40,000+ hrs). Mechanical bearing and lubricant degradation statistically increases failure probability. Ensure RAID/ZFS redundancy.';
  } else if (ageYears >= 3.5 || currentPoh >= 30000) {
    phase = 'mature';
    phaseLabel = 'Mature Operating Phase';
    bathtubProgress = 55 + Math.round(((ageYears - 3.5) / 1.5) * 20);
    riskLevel = 'moderate';
    riskTitle = 'Mature Disk (Normal Wear)';
    riskDescription = 'Approaching standard warranty threshold. Operating smoothly, but mechanical aging is progressing. Continue routine monthly parity scrubs.';
  } else {
    phase = 'prime';
    phaseLabel = 'Prime Operational Phase';
    bathtubProgress = 25 + Math.round(((ageYears - 0.35) / 3.15) * 25);
    riskLevel = 'low';
    riskTitle = 'Lowest Statistical Failure Rate';
    riskDescription = 'Drive is in the optimal bathtub curve sweet spot with the lowest historical failure rates across enterprise fleet data.';
  }

  // Critical overrides if SMART detected bad health or reallocated sectors
  if (hasBadSectors || healthStatus === 'Bad') {
    riskLevel = 'critical';
    riskTitle = 'Critical Replacement Recommended';
    riskDescription = 'Drive has sector reallocation or critical SMART warnings. Failures typically accelerate exponentially once bad sectors emerge.';
  } else if (healthStatus === 'Caution') {
    riskLevel = 'elevated';
    riskTitle = 'Caution - Monitor Closely';
    riskDescription = 'Drive SMART state is flagged with caution. Back up data immediately and watch scrub logs.';
  }

  return {
    age_info: {
      manufactureDate: manufactureDateStr,
      ageYears,
      ageMonths,
      formattedAge,
      totalCalendarHours,
      dutyCyclePercent
    },
    risk_assessment: {
      phase,
      phaseLabel,
      riskLevel,
      riskTitle,
      riskDescription,
      bathtubProgress
    }
  };
}

// ==========================================
// API ROUTES
// ==========================================

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

    stmt.run({
      id,
      custom_id,
      serial_number: body.serial_number.trim(),
      model: body.model.trim(),
      capacity_gb: parseInt(body.capacity_gb, 10),
      form_factor: body.form_factor || '3.5" HDD',
      interface: body.interface || 'SATA III',
      status: body.status || 'Active',
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
        form_factor = @form_factor,
        interface = @interface,
        status = @status,
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
      form_factor: body.form_factor || (drive as any).form_factor,
      interface: body.interface || (drive as any).interface,
      status: body.status || (drive as any).status,
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
