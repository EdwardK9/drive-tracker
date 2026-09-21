import { Drive, DriveDetail, OverviewStats, ParsedCrystalDiskInfo, CrystalDiskLog } from './types';

export async function fetchStats(): Promise<OverviewStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchDrives(): Promise<Drive[]> {
  const res = await fetch('/api/drives');
  if (!res.ok) throw new Error('Failed to fetch drives');
  return res.json();
}

export async function fetchDriveDetail(id: string): Promise<DriveDetail> {
  const res = await fetch(`/api/drives/${id}`);
  if (!res.ok) throw new Error('Failed to fetch drive details');
  return res.json();
}

export async function createDrive(data: Partial<Drive>): Promise<Drive> {
  const res = await fetch('/api/drives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create drive');
  }
  return res.json();
}

export async function updateDrive(id: string, data: Partial<Drive>): Promise<Drive> {
  const res = await fetch(`/api/drives/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update drive');
  }
  return res.json();
}

export async function deleteDrive(id: string): Promise<void> {
  const res = await fetch(`/api/drives/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete drive');
}

export async function parseCrystalDiskInfoText(rawText: string): Promise<{
  parsed: ParsedCrystalDiskInfo;
  matchedDrive: Drive | null;
}> {
  const res = await fetch('/api/parse-crystaldiskinfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to parse CrystalDiskInfo text');
  }
  return res.json();
}

export async function addCrystalDiskLog(driveId: string, logData: Partial<CrystalDiskLog>): Promise<CrystalDiskLog> {
  const res = await fetch(`/api/drives/${driveId}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(logData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add log');
  }
  return res.json();
}

export async function deleteCrystalDiskLog(logId: string): Promise<void> {
  const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete log');
}

export async function uploadReceipt(driveId: string, file: File, label?: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  if (label) formData.append('label', label);

  const res = await fetch(`/api/drives/${driveId}/upload-receipt`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload receipt');
  }
  return res.json();
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  const res = await fetch(`/api/receipts/${receiptId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete receipt');
}

export async function parseCrystalDiskScreenshotApi(
  fileOrBase64: File | string,
  mimeType: string = 'image/png'
): Promise<{
  parsed: ParsedCrystalDiskInfo;
  rawText: string;
  matchedDrive: Drive | null;
}> {
  let res: Response;
  if (typeof fileOrBase64 === 'string') {
    res = await fetch('/api/parse-crystaldisk-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: fileOrBase64, mimeType })
    });
  } else {
    const formData = new FormData();
    formData.append('screenshot', fileOrBase64);
    res = await fetch('/api/parse-crystaldisk-image', {
      method: 'POST',
      body: formData
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to parse CrystalDiskInfo screenshot');
  }
  return res.json();
}

export async function quickUpdateManufactureDate(driveId: string, manufactureDate: string | null): Promise<Drive> {
  const res = await fetch(`/api/drives/${driveId}/manufacture-date`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manufacture_date: manufactureDate })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update manufacture date');
  }
  return res.json();
}

export async function importBackup(backupData: any): Promise<any> {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to import backup');
  }
  return res.json();
}
