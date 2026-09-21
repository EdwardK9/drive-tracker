export interface SmartAttribute {
  id: string;
  name: string;
  current: string;
  worst: string;
  threshold: string;
  rawValue: string;
  isWarning?: boolean;
}

export interface CrystalDiskLog {
  id: string;
  drive_id: string;
  log_date: string;
  health_status: 'Good' | 'Caution' | 'Bad' | 'Unknown';
  health_percentage?: number | null;
  temperature_c?: number | null;
  temperature_f?: number | null;
  power_on_hours?: number | null;
  power_on_count?: number | null;
  host_reads_gb?: number | null;
  host_writes_gb?: number | null;
  transfer_mode?: string | null;
  raw_crystal_text?: string | null;
  smart_attributes?: SmartAttribute[];
  log_notes?: string | null;
  created_at: string;
}

export interface DriveReceipt {
  id: string;
  drive_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  label?: string | null;
}

export interface WarrantyInfo {
  status: 'active' | 'expiring_soon' | 'expired' | 'none';
  daysLeft: number | null;
  label: string;
}

export interface RuntimeWearInfo {
  phase: 'burn_in' | 'prime' | 'mature' | 'wear_out';
  phaseLabel: string;
  poh: number;
  progressPercent: number;
  equivalent247Years: number;
  description: string;
}

export interface DriveAgeInfo {
  manufactureDate: string;
  ageYears: number;
  ageMonths: number;
  formattedAge: string;
  totalCalendarHours: number;
  dutyCyclePercent: number;
  shelfProfile: string;
  shelfAdvice: string;
}

export interface DriveRiskAssessment {
  phase: 'burn_in' | 'prime' | 'mature' | 'wear_out';
  phaseLabel: string;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'critical';
  riskTitle: string;
  riskDescription: string;
  bathtubProgress: number;
  runtimeWear: RuntimeWearInfo;
}

export interface Drive {
  id: string;
  custom_id: string;
  serial_number: string;
  model: string;
  capacity_gb: number;
  usable_capacity_gb?: number | null;
  form_factor: string;
  interface: string;
  status: 'Active' | 'Spare' | 'Cold Storage' | 'RMA' | 'Failed' | 'Replaced';
  location?: string | null;
  vendor?: string | null;
  manufacture_date?: string | null;
  purchase_date?: string | null;
  order_number?: string | null;
  purchase_price?: number | null;
  currency?: string;
  warranty_months?: number;
  warranty_expires?: string | null;
  initial_power_on_hours?: number;
  initial_power_on_count?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  latest_log?: {
    id: string;
    log_date: string;
    health_status: 'Good' | 'Caution' | 'Bad' | 'Unknown';
    health_percentage?: number | null;
    temperature_c?: number | null;
    temperature_f?: number | null;
    power_on_hours?: number | null;
    power_on_count?: number | null;
    host_reads_gb?: number | null;
    host_writes_gb?: number | null;
  } | null;
  log_count?: number;
  receipt_count?: number;
  warranty_info?: WarrantyInfo;
  age_info?: DriveAgeInfo | null;
  risk_assessment?: DriveRiskAssessment | null;
}

export interface DriveDetail extends Drive {
  logs: CrystalDiskLog[];
  receipts: DriveReceipt[];
}

export interface OverviewStats {
  totalDrives: number;
  totalCapacityGB: number;
  totalCapacityTB: string;
  totalLogs: number;
  totalReceipts: number;
  health: {
    good: number;
    caution: number;
    bad: number;
    unknown: number;
  };
  warranty: {
    expiringSoon: number;
    expired: number;
  };
  averageTemperatureC: number | null;
}

export interface ParsedCrystalDiskInfo {
  model?: string;
  serialNumber?: string;
  firmware?: string;
  interface?: string;
  transferMode?: string;
  powerOnHours?: number;
  powerOnCount?: number;
  temperatureC?: number;
  temperatureF?: number;
  healthStatus?: 'Good' | 'Caution' | 'Bad' | 'Unknown';
  healthPercentage?: number;
  hostReadsGB?: number;
  hostWritesGB?: number;
  capacityGB?: number;
  smartAttributes: SmartAttribute[];
  criticalWarnings: string[];
  rawText: string;
}
