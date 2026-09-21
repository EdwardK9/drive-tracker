export interface ParsedSmartAttribute {
  id: string;
  name: string;
  current: string;
  worst: string;
  threshold: string;
  rawValue: string;
  isWarning?: boolean;
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
  smartAttributes: ParsedSmartAttribute[];
  criticalWarnings: string[];
  rawText: string;
}

export function parseCrystalDiskInfo(raw: string): ParsedCrystalDiskInfo {
  const result: ParsedCrystalDiskInfo = {
    smartAttributes: [],
    criticalWarnings: [],
    rawText: raw.trim()
  };

  if (!raw || typeof raw !== 'string') {
    return result;
  }

  // Normalize line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Model
  const modelMatch = text.match(/(?:Model\s*:\s*|Drive Model\s*:\s*)([^\n\r]+)/i);
  if (modelMatch && modelMatch[1]) {
    result.model = modelMatch[1].trim();
  }

  // 2. Serial Number
  const serialMatch = text.match(/(?:Serial Number|Serial No\.?|Serial)\s*:\s*([^\n\r]+)/i);
  if (serialMatch && serialMatch[1]) {
    result.serialNumber = serialMatch[1].trim();
  }

  // 3. Firmware
  const fwMatch = text.match(/Firmware\s*:\s*([^\n\r]+)/i);
  if (fwMatch && fwMatch[1]) {
    result.firmware = fwMatch[1].trim();
  }

  // 4. Interface
  const ifaceMatch = text.match(/Interface\s*:\s*([^\n\r]+)/i);
  if (ifaceMatch && ifaceMatch[1]) {
    result.interface = ifaceMatch[1].trim();
  }

  // 5. Transfer Mode
  const xferMatch = text.match(/Transfer Mode\s*:\s*([^\n\r]+)/i);
  if (xferMatch && xferMatch[1]) {
    result.transferMode = xferMatch[1].trim();
  }

  // 6. Power On Hours
  const pohMatch = text.match(/Power On Hours\s*:\s*([\d,\s]+)(?:hours)?/i);
  if (pohMatch && pohMatch[1]) {
    const cleaned = pohMatch[1].replace(/[,\s]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val)) result.powerOnHours = val;
  } else {
    // Fallback: "12345 hours"
    const fallbackPoh = text.match(/([\d,]+)\s+hours/i);
    if (fallbackPoh && fallbackPoh[1]) {
      const val = parseInt(fallbackPoh[1].replace(/,/g, ''), 10);
      if (!isNaN(val)) result.powerOnHours = val;
    }
  }

  // 7. Power On Count
  const pocMatch = text.match(/Power On Count\s*:\s*([\d,\s]+)(?:count|times)?/i);
  if (pocMatch && pocMatch[1]) {
    const cleaned = pocMatch[1].replace(/[,\s]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val)) result.powerOnCount = val;
  }

  // 8. Temperature
  const tempMatch = text.match(/Temperature\s*:\s*(\d+)\s*(?:C|°C)(?:\s*\(\s*(\d+)\s*(?:F|°F)\s*\))?/i);
  if (tempMatch && tempMatch[1]) {
    result.temperatureC = parseInt(tempMatch[1], 10);
    if (tempMatch[2]) {
      result.temperatureF = parseInt(tempMatch[2], 10);
    } else {
      result.temperatureF = Math.round((result.temperatureC * 9) / 5 + 32);
    }
  } else {
    // Fallback: e.g. "36 C" or "36°C"
    const altTemp = text.match(/(\d+)\s*(?:°C|C)\b/i);
    if (altTemp && altTemp[1]) {
      const c = parseInt(altTemp[1], 10);
      if (c >= 10 && c <= 95) {
        result.temperatureC = c;
        result.temperatureF = Math.round((c * 9) / 5 + 32);
      }
    }
  }

  // 9. Health Status & Percentage
  const healthMatch = text.match(/Health Status\s*:\s*([^\n\r]+)/i);
  if (healthMatch && healthMatch[1]) {
    const healthRaw = healthMatch[1].trim();
    if (/caution|warning/i.test(healthRaw)) {
      result.healthStatus = 'Caution';
    } else if (/bad|failed|danger/i.test(healthRaw)) {
      result.healthStatus = 'Bad';
    } else if (/good/i.test(healthRaw)) {
      result.healthStatus = 'Good';
    } else {
      result.healthStatus = 'Unknown';
    }

    // Check for percentage e.g. "Good (100 %)" or "98 %" or "100%"
    const pctMatch = healthRaw.match(/(\d{1,3})\s*%/);
    if (pctMatch && pctMatch[1]) {
      result.healthPercentage = parseInt(pctMatch[1], 10);
    }
  } else {
    // Check if raw mentions Good/Caution/Bad in prominent position
    if (/\bHealth Status\b/i.test(text)) {
      result.healthStatus = 'Unknown';
    }
  }

  // 10. Host Reads / Writes
  const readsMatch = text.match(/Host Reads\s*:\s*([\d,.]+)\s*(GB|TB)/i);
  if (readsMatch && readsMatch[1] && readsMatch[2]) {
    const num = parseFloat(readsMatch[1].replace(/,/g, ''));
    result.hostReadsGB = readsMatch[2].toUpperCase() === 'TB' ? Math.round(num * 1024) : Math.round(num);
  }

  const writesMatch = text.match(/Host Writes\s*:\s*([\d,.]+)\s*(GB|TB)/i);
  if (writesMatch && writesMatch[1] && writesMatch[2]) {
    const num = parseFloat(writesMatch[1].replace(/,/g, ''));
    result.hostWritesGB = writesMatch[2].toUpperCase() === 'TB' ? Math.round(num * 1024) : Math.round(num);
  }

  // 11. Capacity
  const capMatch = text.match(/(?:Disk Size|Capacity)\s*:\s*([\d,.]+)\s*(GB|TB)/i);
  if (capMatch && capMatch[1] && capMatch[2]) {
    const num = parseFloat(capMatch[1].replace(/,/g, ''));
    result.capacityGB = capMatch[2].toUpperCase() === 'TB' ? Math.round(num * 1000) : Math.round(num);
  } else {
    // Try from disk list line: e.g. "(01) ST18000NM000J : 18000.2 GB"
    const diskListCap = text.match(/:\s*([\d,.]+)\s*(GB|TB)/i);
    if (diskListCap && diskListCap[1] && diskListCap[2]) {
      const num = parseFloat(diskListCap[1].replace(/,/g, ''));
      result.capacityGB = diskListCap[2].toUpperCase() === 'TB' ? Math.round(num * 1000) : Math.round(num);
    }
  }

  // 12. Parse S.M.A.R.T. Attributes table if present
  // Typical header: ID Cur Wor Thr RawValues(6) Attribute Name
  const smartHeaderIdx = text.search(/ID\s+Cur\s+Wor\s+Thr\s+RawValues/i);
  if (smartHeaderIdx !== -1) {
    const tableSection = text.slice(smartHeaderIdx);
    const lines = tableSection.split('\n').slice(1);

    for (const line of lines) {
      if (!line.trim() || line.startsWith('--') || line.startsWith('===')) {
        if (result.smartAttributes.length > 0) break;
        continue;
      }

      // Format: ID Cur Wor Thr RawValues Attribute Name
      // Example: 05 100 100  10 000000000000 Reallocated Sectors Count
      // Or:      C5 100 100 --- 000000000000 Current Pending Sector Count
      const attrMatch = line.trim().match(/^([0-9A-Fa-f]{2})\s+([\d-]+)\s+([\d-]+)\s+([\d-]+|-{3})\s+([0-9A-Fa-f]+)\s+(.+)$/);
      if (attrMatch) {
        const id = attrMatch[1].toUpperCase();
        const current = attrMatch[2];
        const worst = attrMatch[3];
        const threshold = attrMatch[4];
        const rawValue = attrMatch[5];
        const name = attrMatch[6].trim();

        // Check for common critical warning attributes
        let isWarning = false;
        const rawInt = parseInt(rawValue, 16);

        if ((id === '05' || name.includes('Reallocated Sector')) && rawInt > 0) {
          isWarning = true;
          result.criticalWarnings.push(`Reallocated Sectors Count: ${rawInt} sector(s) reallocated`);
        }
        if ((id === 'C5' || name.includes('Current Pending Sector')) && rawInt > 0) {
          isWarning = true;
          result.criticalWarnings.push(`Current Pending Sectors: ${rawInt} sector(s) waiting to be remapped`);
        }
        if ((id === 'C6' || name.includes('Offline Uncorrectable')) && rawInt > 0) {
          isWarning = true;
          result.criticalWarnings.push(`Offline Uncorrectable Sectors: ${rawInt}`);
        }
        if ((id === '01' || name.includes('Raw Read Error Rate')) && rawInt > 1000 && !/seagate/i.test(result.model || '')) {
          // Note: Seagate raw read error rate uses a 48-bit compound hex value, so high numbers are normal on Seagate
        }
        if ((id === 'C7' || name.includes('UltraDMA CRC Error')) && rawInt > 0) {
          result.criticalWarnings.push(`UltraDMA CRC Errors: ${rawInt} (Check SATA cable/backplane connection)`);
        }

        result.smartAttributes.push({
          id,
          name,
          current,
          worst,
          threshold,
          rawValue,
          isWarning
        });
      }
    }
  }

  // If critical warnings were found but health was 'Good', flag Caution
  if (result.criticalWarnings.length > 0 && (!result.healthStatus || result.healthStatus === 'Good')) {
    result.healthStatus = 'Caution';
  }

  return result;
}
