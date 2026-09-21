import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'drives.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and performance in Docker
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drives (
      id TEXT PRIMARY KEY,
      custom_id TEXT,
      serial_number TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      capacity_gb INTEGER NOT NULL,
      form_factor TEXT DEFAULT '3.5" HDD',
      interface TEXT DEFAULT 'SATA III',
      status TEXT DEFAULT 'Active',
      vendor TEXT,
      purchase_date TEXT,
      order_number TEXT,
      purchase_price REAL,
      currency TEXT DEFAULT 'USD',
      warranty_months INTEGER DEFAULT 36,
      warranty_expires TEXT,
      initial_power_on_hours INTEGER DEFAULT 0,
      initial_power_on_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crystal_disk_logs (
      id TEXT PRIMARY KEY,
      drive_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      health_status TEXT DEFAULT 'Good',
      health_percentage INTEGER,
      temperature_c INTEGER,
      temperature_f INTEGER,
      power_on_hours INTEGER,
      power_on_count INTEGER,
      host_reads_gb REAL,
      host_writes_gb REAL,
      transfer_mode TEXT,
      raw_crystal_text TEXT,
      smart_attributes_json TEXT,
      log_notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (drive_id) REFERENCES drives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS drive_receipts (
      id TEXT PRIMARY KEY,
      drive_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      label TEXT,
      FOREIGN KEY (drive_id) REFERENCES drives(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_drives_serial ON drives(serial_number);
    CREATE INDEX IF NOT EXISTS idx_logs_drive_id ON crystal_disk_logs(drive_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_drive_id ON drive_receipts(drive_id);
  `);

  // Seed sample drives if empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM drives').get() as { cnt: number };
  if (count.cnt === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertDrive = db.prepare(`
    INSERT INTO drives (
      id, custom_id, serial_number, model, capacity_gb, form_factor, interface,
      status, vendor, purchase_date, order_number, purchase_price, currency,
      warranty_months, warranty_expires, initial_power_on_hours, initial_power_on_count,
      notes, created_at, updated_at
    ) VALUES (
      @id, @custom_id, @serial_number, @model, @capacity_gb, @form_factor, @interface,
      @status, @vendor, @purchase_date, @order_number, @purchase_price, @currency,
      @warranty_months, @warranty_expires, @initial_power_on_hours, @initial_power_on_count,
      @notes, @created_at, @updated_at
    )
  `);

  const insertLog = db.prepare(`
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

  // 1. Seagate Exos X18 18TB (Refurb from ServerPartDeals)
  const d1Id = 'drv-exos-18tb-01';
  insertDrive.run({
    id: d1Id,
    custom_id: 'DRV-01',
    serial_number: 'ZR50ABCD',
    model: 'ST18000NM000J-2TV103',
    capacity_gb: 18000,
    form_factor: '3.5" HDD',
    interface: 'SATA III',
    status: 'Active',
    vendor: 'ServerPartDeals',
    purchase_date: '2024-01-15',
    order_number: 'SPD-884920',
    purchase_price: 199.99,
    currency: 'USD',
    warranty_months: 24,
    warranty_expires: '2026-01-15',
    initial_power_on_hours: 8200,
    initial_power_on_count: 22,
    notes: 'Recertified enterprise drive. TrueNAS ZFS Pool Alpha, Bay 1. Passed 3-pass badblocks burn-in test.',
    created_at: new Date('2024-01-15T12:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  });

  // History logs for Drive 1
  insertLog.run({
    id: 'log-d1-01',
    drive_id: d1Id,
    log_date: '2024-01-16',
    health_status: 'Good',
    health_percentage: 100,
    temperature_c: 34,
    temperature_f: 93,
    power_on_hours: 8210,
    power_on_count: 23,
    host_reads_gb: null,
    host_writes_gb: null,
    transfer_mode: 'SATA/600',
    raw_crystal_text: `Model : ST18000NM000J-2TV103\nSerial Number : ZR50ABCD\nPower On Hours : 8210 hours\nPower On Count : 23 count\nTemperature : 34 C (93 F)\nHealth Status : Good`,
    smart_attributes_json: JSON.stringify([
      { id: '05', name: 'Reallocated Sectors Count', current: '100', worst: '100', threshold: '10', rawValue: '000000000000', isWarning: false },
      { id: 'C5', name: 'Current Pending Sector Count', current: '100', worst: '100', threshold: '---', rawValue: '000000000000', isWarning: false }
    ]),
    log_notes: 'Initial burn-in post receipt scan. 0 reallocated sectors.',
    created_at: new Date('2024-01-16T10:00:00Z').toISOString()
  });

  insertLog.run({
    id: 'log-d1-02',
    drive_id: d1Id,
    log_date: '2024-06-20',
    health_status: 'Good',
    health_percentage: 100,
    temperature_c: 37,
    temperature_f: 98,
    power_on_hours: 11950,
    power_on_count: 27,
    host_reads_gb: null,
    host_writes_gb: null,
    transfer_mode: 'SATA/600',
    raw_crystal_text: `Model : ST18000NM000J-2TV103\nSerial Number : ZR50ABCD\nPower On Hours : 11950 hours\nPower On Count : 27 count\nTemperature : 37 C (98 F)\nHealth Status : Good`,
    smart_attributes_json: JSON.stringify([
      { id: '05', name: 'Reallocated Sectors Count', current: '100', worst: '100', threshold: '10', rawValue: '000000000000', isWarning: false },
      { id: 'C5', name: 'Current Pending Sector Count', current: '100', worst: '100', threshold: '---', rawValue: '000000000000', isWarning: false }
    ]),
    log_notes: 'Routine quarterly checkup. Running cool in rack.',
    created_at: new Date('2024-06-20T15:00:00Z').toISOString()
  });

  insertLog.run({
    id: 'log-d1-03',
    drive_id: d1Id,
    log_date: '2024-11-10',
    health_status: 'Good',
    health_percentage: 100,
    temperature_c: 36,
    temperature_f: 96,
    power_on_hours: 15410,
    power_on_count: 31,
    host_reads_gb: null,
    host_writes_gb: null,
    transfer_mode: 'SATA/600',
    raw_crystal_text: `Model : ST18000NM000J-2TV103\nSerial Number : ZR50ABCD\nPower On Hours : 15410 hours\nPower On Count : 31 count\nTemperature : 36 C (96 F)\nHealth Status : Good`,
    smart_attributes_json: JSON.stringify([
      { id: '05', name: 'Reallocated Sectors Count', current: '100', worst: '100', threshold: '10', rawValue: '000000000000', isWarning: false },
      { id: 'C5', name: 'Current Pending Sector Count', current: '100', worst: '100', threshold: '---', rawValue: '000000000000', isWarning: false }
    ]),
    log_notes: 'Latest check. ZFS scrub completed with zero errors.',
    created_at: new Date('2024-11-10T11:00:00Z').toISOString()
  });

  // 2. WD Red Plus 14TB (New from Amazon)
  const d2Id = 'drv-wd-red-14tb-02';
  insertDrive.run({
    id: d2Id,
    custom_id: 'DRV-02',
    serial_number: '9LGE24KX',
    model: 'WDC WD140EFGX-68B0GN0',
    capacity_gb: 14000,
    form_factor: '3.5" HDD',
    interface: 'SATA III',
    status: 'Active',
    vendor: 'Amazon',
    purchase_date: '2023-08-04',
    order_number: '114-7291844-0192842',
    purchase_price: 249.99,
    currency: 'USD',
    warranty_months: 36,
    warranty_expires: '2026-08-04',
    initial_power_on_hours: 0,
    initial_power_on_count: 1,
    notes: 'Purchased brand new retail. TrueNAS ZFS Pool Alpha, Bay 2.',
    created_at: new Date('2023-08-04T12:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  });

  insertLog.run({
    id: 'log-d2-01',
    drive_id: d2Id,
    log_date: '2024-10-01',
    health_status: 'Good',
    health_percentage: 100,
    temperature_c: 35,
    temperature_f: 95,
    power_on_hours: 10150,
    power_on_count: 18,
    host_reads_gb: null,
    host_writes_gb: null,
    transfer_mode: 'SATA/600',
    raw_crystal_text: `Model : WDC WD140EFGX-68B0GN0\nSerial Number : 9LGE24KX\nPower On Hours : 10150 hours\nPower On Count : 18 count\nTemperature : 35 C (95 F)\nHealth Status : Good`,
    smart_attributes_json: JSON.stringify([]),
    log_notes: 'Zero sector errors. Healthy CMR drive.',
    created_at: new Date('2024-10-01T10:00:00Z').toISOString()
  });

  // 3. Samsung 990 PRO 2TB NVMe SSD
  const d3Id = 'drv-samsung-990-2tb-03';
  insertDrive.run({
    id: d3Id,
    custom_id: 'NVME-BOOT',
    serial_number: 'S73WNJ0W918230',
    model: 'Samsung SSD 990 PRO 2TB',
    capacity_gb: 2000,
    form_factor: 'M.2 NVMe',
    interface: 'PCIe 4.0 x4',
    status: 'Active',
    vendor: 'Newegg',
    purchase_date: '2023-11-24',
    order_number: 'NEG-481920-A',
    purchase_price: 159.99,
    currency: 'USD',
    warranty_months: 60,
    warranty_expires: '2028-11-24',
    initial_power_on_hours: 0,
    initial_power_on_count: 2,
    notes: 'Proxmox Hypervisor OS & VM template storage pool.',
    created_at: new Date('2023-11-24T12:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  });

  insertLog.run({
    id: 'log-d3-01',
    drive_id: d3Id,
    log_date: '2024-11-05',
    health_status: 'Good',
    health_percentage: 99,
    temperature_c: 44,
    temperature_f: 111,
    power_on_hours: 8350,
    power_on_count: 54,
    host_reads_gb: 34200,
    host_writes_gb: 28500,
    transfer_mode: 'PCIe 4.0 x4',
    raw_crystal_text: `Model : Samsung SSD 990 PRO 2TB\nSerial Number : S73WNJ0W918230\nHost Reads : 34200 GB\nHost Writes : 28500 GB\nPower On Hours : 8350 hours\nPower On Count : 54 count\nTemperature : 44 C (111 F)\nHealth Status : Good (99 %)`,
    smart_attributes_json: JSON.stringify([]),
    log_notes: '99% life remaining after 28.5 TB written. Within normal endurance.',
    created_at: new Date('2024-11-05T12:00:00Z').toISOString()
  });
}

export { db, DB_PATH, DATA_DIR };
