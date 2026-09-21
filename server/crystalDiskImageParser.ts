import { GoogleGenAI } from '@google/genai';
import { ParsedCrystalDiskInfo, SmartAttribute } from '../src/types/index.js';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required for CrystalDiskInfo screenshot OCR. Please provide GEMINI_API_KEY or use the "Paste Raw Text" option.'
      );
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function parseCrystalDiskScreenshot(
  imageBuffer: Buffer,
  mimeType: string = 'image/png'
): Promise<{ parsed: ParsedCrystalDiskInfo; rawText: string }> {
  const ai = getGenAI();
  const base64Data = imageBuffer.toString('base64');

  const prompt = `You are a precision hardware optical character recognition (OCR) and SMART diagnostic analyzer specialized in CrystalDiskInfo application windows.
Carefully examine the provided CrystalDiskInfo screenshot image and extract all drive metrics, hardware identification, and the full SMART attributes table.

Return a pure JSON object adhering to this structure:
{
  "model": "model name string (e.g. TOSHIBA MG06ACA10TE)",
  "capacityGB": number (e.g. for "10000.8 GB" return 10000, for "18000 GB" return 18000),
  "serialNumber": "serial number string (e.g. Z9L0A048FKQE)",
  "firmware": "firmware string (e.g. 0104)",
  "interface": "interface string (e.g. SATA, USB (Serial ATA), NVM Express)",
  "transferMode": "transfer mode string (e.g. SATA/150 | SATA/600)",
  "rotationRate": "rotation rate string (e.g. 7200 RPM, SSD)",
  "healthStatus": "Good" | "Caution" | "Bad" | "Unknown",
  "healthPercentage": number or null (e.g. 100 or null if not shown as percent),
  "temperatureC": number or null (e.g. 44),
  "temperatureF": number or null (convert if only Celsius is shown: F = round(C * 9/5 + 32)),
  "powerOnHours": number or null (e.g. for "8463 hours" return 8463),
  "powerOnCount": number or null (e.g. for "431 count" return 431),
  "hostReadsGB": number or null,
  "hostWritesGB": number or null,
  "smartAttributes": [
    {
      "id": "Hex ID string (e.g. 01, 05, 09, 0C, C5, C6)",
      "name": "Attribute name (e.g. Read Error Rate, Reallocated Sectors Count)",
      "current": "string current value (e.g. 100)",
      "worst": "string worst value (e.g. 100)",
      "threshold": "string threshold value (e.g. 10 or 50)",
      "rawValue": "string raw value hex/decimal (e.g. 000000000000)"
    }
  ]
}

Ensure all rows in the visible SMART attribute table are captured with accurate IDs and names.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    config: {
      responseMimeType: 'application/json'
    }
  });

  const responseText = response.text || '{}';
  let json: any;
  try {
    json = JSON.parse(responseText);
  } catch (err: any) {
    throw new Error(`Failed to parse AI model response as JSON: ${err.message}`);
  }

  const smartAttributes: SmartAttribute[] = (json.smartAttributes || []).map((attr: any) => {
    const isWarning =
      (attr.id === '05' || attr.name?.toLowerCase().includes('reallocated')) &&
      parseInt(attr.rawValue || '0', 16) > 0;
    const isPending =
      (attr.id === 'C5' || attr.name?.toLowerCase().includes('pending')) &&
      parseInt(attr.rawValue || '0', 16) > 0;

    return {
      id: String(attr.id || ''),
      name: String(attr.name || ''),
      current: String(attr.current ?? ''),
      worst: String(attr.worst ?? ''),
      threshold: String(attr.threshold ?? ''),
      rawValue: String(attr.rawValue ?? ''),
      isWarning: isWarning || isPending
    };
  });

  const criticalWarnings: string[] = [];
  smartAttributes.forEach((attr) => {
    if (attr.id === '05' && parseInt(attr.rawValue || '0', 16) > 0) {
      criticalWarnings.push(`Reallocated Sectors Count: ${attr.rawValue}`);
    }
    if (attr.id === 'C5' && parseInt(attr.rawValue || '0', 16) > 0) {
      criticalWarnings.push(`Current Pending Sector Count: ${attr.rawValue}`);
    }
  });

  // Synthesize standard CrystalDisk text report format for archival
  const dateStr = new Date().toISOString().split('T')[0];
  const synthText = [
    `----------------------------------------------------------------------------`,
    `CrystalDiskInfo 9.x Report (Extracted from Screenshot OCR)`,
    `Date : ${dateStr}`,
    `----------------------------------------------------------------------------`,
    `Model : ${json.model || 'Unknown'}`,
    `Disk Size : ${json.capacityGB ? `${json.capacityGB} GB` : 'Unknown'}`,
    `Serial Number : ${json.serialNumber || 'Unknown'}`,
    `Firmware : ${json.firmware || 'Unknown'}`,
    `Interface : ${json.interface || 'SATA'}`,
    `Transfer Mode : ${json.transferMode || 'SATA/600'}`,
    `Power On Hours : ${json.powerOnHours !== undefined ? `${json.powerOnHours} hours` : 'Unknown'}`,
    `Power On Count : ${json.powerOnCount !== undefined ? `${json.powerOnCount} count` : 'Unknown'}`,
    `Temperature : ${json.temperatureC !== undefined ? `${json.temperatureC} C (${json.temperatureF || Math.round((json.temperatureC * 9) / 5 + 32)} F)` : 'Unknown'}`,
    `Health Status : ${json.healthStatus || 'Good'}`,
    ``,
    `-- S.M.A.R.T. --------------------------------------------------------------`,
    `ID Cur Wor Thr RawValues(6) Attribute Name`,
    ...smartAttributes.map(
      (a) =>
        `${a.id.padStart(2, '0')} ${a.current.padStart(3, ' ')} ${a.worst.padStart(3, ' ')} ${a.threshold.padStart(3, ' ')} ${a.rawValue.padStart(12, ' ')} ${a.name}`
    )
  ].join('\n');

  const parsed: ParsedCrystalDiskInfo = {
    model: json.model || undefined,
    serialNumber: json.serialNumber || undefined,
    firmware: json.firmware || undefined,
    interface: json.interface || undefined,
    transferMode: json.transferMode || undefined,
    powerOnHours: typeof json.powerOnHours === 'number' ? json.powerOnHours : undefined,
    powerOnCount: typeof json.powerOnCount === 'number' ? json.powerOnCount : undefined,
    temperatureC: typeof json.temperatureC === 'number' ? json.temperatureC : undefined,
    temperatureF:
      typeof json.temperatureF === 'number'
        ? json.temperatureF
        : typeof json.temperatureC === 'number'
          ? Math.round((json.temperatureC * 9) / 5 + 32)
          : undefined,
    healthStatus: (json.healthStatus as any) || 'Good',
    healthPercentage: typeof json.healthPercentage === 'number' ? json.healthPercentage : undefined,
    hostReadsGB: typeof json.hostReadsGB === 'number' ? json.hostReadsGB : undefined,
    hostWritesGB: typeof json.hostWritesGB === 'number' ? json.hostWritesGB : undefined,
    capacityGB: typeof json.capacityGB === 'number' ? json.capacityGB : undefined,
    smartAttributes,
    criticalWarnings,
    rawText: synthText
  };

  return { parsed, rawText: synthText };
}
