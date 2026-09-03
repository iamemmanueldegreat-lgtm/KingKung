import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type CurriculumSource = 'NBTE' | 'CCMAS' | 'unknown';

export interface ExtractedCurriculumPdf {
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: string[];
  text: string;
  source: CurriculumSource;
  suggestedDepartment: string | null;
  detectedLevels: string[];
  detectedSemesters: number[];
}

function normalisePageText(items: Array<{ str?: string }>) {
  return items
    .map(item => item.str ?? '')
    .join('\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectSource(text: string): CurriculumSource {
  const upper = text.toUpperCase();
  if (upper.includes('NATIONAL BOARD FOR TECHNICAL EDUCATION') || upper.includes('NATIONAL DIPLOMA')) {
    return 'NBTE';
  }
  if (upper.includes('CCMAS') || upper.includes('B.SC. COMPUTER SCIENCE') || upper.includes('B.SC COMPUTER SCIENCE')) {
    return 'CCMAS';
  }
  return 'unknown';
}

function detectDepartment(text: string) {
  const match = text.match(/(?:NATIONAL DIPLOMA|B\.?SC\.?)\s*(?:IN\s+)?([A-Z][A-Z &/.-]{3,80}?)(?:\n|PROGRAMME|CURRICULUM|OVERVIEW)/i);
  if (match?.[1]) {
    return match[1].replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  }
  if (/COMPUTER SCIENCE/i.test(text)) return 'Computer Science';
  return null;
}

function detectLevels(text: string, source: CurriculumSource) {
  const levels = new Set<string>();
  if (source === 'NBTE') {
    const hasHigherNationalDiploma = /HIGHER\s+NATIONAL\s+DIPLOMA|\bHND\b/i.test(text);
    const hasNationalDiploma = /\bNATIONAL\s+DIPLOMA\b|\bND\b/i.test(text);
    const hasYearOne = /YEAR\s+I\b|\bYEAR\s+1\b/i.test(text);
    const hasYearTwo = /YEAR\s+II\b|\bYEAR\s+2\b/i.test(text);

    // HND documents commonly label their two levels as Year I and Year II.
    // Prefer HND labels when the document identifies itself as HND; otherwise
    // treat the same year headings as the ND1/ND2 structure.
    if (hasHigherNationalDiploma) {
      if (hasYearOne) levels.add('HND1');
      if (hasYearTwo) levels.add('HND2');
    } else if (hasNationalDiploma) {
      if (hasYearOne) levels.add('ND1');
      if (hasYearTwo) levels.add('ND2');
    }

    if (hasHigherNationalDiploma && !hasYearOne && !hasYearTwo) {
      levels.add('HND1');
      levels.add('HND2');
    }
  } else if (source === 'CCMAS') {
    for (const level of ['100', '200', '300', '400', '500', '600']) {
      if (new RegExp(`\\b${level}\\s+Level\\b`, 'i').test(text)) levels.add(`${level} Level`);
    }
  }
  return Array.from(levels);
}

function detectSemesters(text: string) {
  const semesters = new Set<number>();
  if (/SEMESTER\s+I\b/i.test(text)) semesters.add(1);
  if (/SEMESTER\s+II\b/i.test(text)) semesters.add(2);
  return Array.from(semesters).sort();
}

export async function extractCurriculumPdf(file: File): Promise<ExtractedCurriculumPdf> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please choose a PDF curriculum file.');
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, disableAutoFetch: false, disableStream: false }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(normalisePageText(content.items as Array<{ str?: string }>));
  }

  const text = pages
    .map((page, index) => `===== PAGE ${index + 1} =====\n${page}`)
    .join('\n\n');
  const source = detectSource(text);

  return {
    fileName: file.name,
    fileSize: file.size,
    pageCount: pdf.numPages,
    pages,
    text,
    source,
    suggestedDepartment: detectDepartment(text),
    detectedLevels: detectLevels(text, source),
    detectedSemesters: detectSemesters(text),
  };
}
