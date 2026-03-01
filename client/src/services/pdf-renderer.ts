/**
 * Renders a PdfContent object into a downloadable PDF using jsPDF.
 * Client-side only — no server involvement. Financial data never leaves the browser.
 */

import { jsPDF } from 'jspdf';
import type { PdfContent, PdfFinding, PdfActionTier } from '../engine/pdf-generator';

// --- Layout constants ---

const PAGE_W = 215.9; // Letter width in mm
const MARGIN = 20;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const LINE_H = 5.5;
const SECTION_GAP = 8;

// Fortress colors (RGB)
const NAVY: [number, number, number] = [30, 58, 95];
const GREEN: [number, number, number] = [34, 197, 94];
const YELLOW: [number, number, number] = [234, 179, 8];
const RED: [number, number, number] = [239, 68, 68];
const GRAY: [number, number, number] = [100, 116, 139];
const BLACK: [number, number, number] = [17, 24, 39];

function tierColor(tier: string): [number, number, number] {
  if (tier === 'green') return GREEN;
  if (tier === 'yellow') return YELLOW;
  return RED;
}

function severityColor(severity: string): [number, number, number] {
  if (severity === 'critical') return RED;
  if (severity === 'warning') return YELLOW;
  return GRAY;
}

// --- PDF generation ---

export function renderSummaryPdf(content: PdfContent): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = MARGIN;

  // --- Helper: check if we need a new page ---
  function ensureSpace(needed: number) {
    if (y + needed > 260) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // --- Header ---
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FORTRESS', MARGIN, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Financial Readiness Summary', MARGIN, 15.5);

  doc.setFontSize(8);
  doc.text('CONFIDENTIAL', PAGE_W - MARGIN, 10, { align: 'right' });
  const dateStr = new Date(content.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.text(dateStr, PAGE_W - MARGIN, 15.5, { align: 'right' });

  y = 30;

  // --- Section 1: Military Profile ---
  y = sectionTitle(doc, 'Military Profile', y);
  const { military: m } = content;
  const profileRows = [
    ['Pay Grade', m.payGrade],
    ['Years of Service', String(m.yearsOfService)],
    ['Dependents', String(m.dependents)],
    ['Duty Station', m.dutyStation],
    ['Component', m.component],
    ['Retirement System', m.retirementSystem],
  ];
  y = renderTable(doc, profileRows, y);
  y += SECTION_GAP;

  // --- Section 2: Risk Score ---
  ensureSpace(25);
  y = sectionTitle(doc, 'Risk Assessment', y);

  // Score circle
  const scoreX = MARGIN + 15;
  doc.setDrawColor(...tierColor(content.riskSummary.tier));
  doc.setLineWidth(1.5);
  doc.circle(scoreX, y + 8, 10);
  doc.setTextColor(...tierColor(content.riskSummary.tier));
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(String(content.riskSummary.score), scoreX, y + 10, { align: 'center' });

  // Tier + quality
  doc.setTextColor(...BLACK);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const tierLabel = content.riskSummary.tier.charAt(0).toUpperCase() + content.riskSummary.tier.slice(1);
  doc.text(`${tierLabel} Tier`, MARGIN + 32, y + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const qualPct = Math.round(content.riskSummary.dataQuality * 100);
  doc.text(`Data completeness: ${qualPct}%`, MARGIN + 32, y + 11);

  if (qualPct < 50) {
    doc.text('(Preliminary — add more data for accuracy)', MARGIN + 32, y + 16);
  }

  y += 24;
  y += SECTION_GAP;

  // --- Section 3: Risk Findings ---
  if (content.findings.length > 0) {
    ensureSpace(20);
    y = sectionTitle(doc, `Risk Findings (${content.findings.length})`, y);
    y = renderFindings(doc, content.findings, y);
    y += SECTION_GAP;
  }

  // --- Section 4: Action Plan ---
  if (content.actionPlan.length > 0) {
    ensureSpace(20);
    y = sectionTitle(doc, 'Action Plan', y);
    y = renderActionPlan(doc, content.actionPlan, y);
    y += SECTION_GAP;
  }

  // --- Section 5: Financial Snapshot ---
  ensureSpace(40);
  y = sectionTitle(doc, 'Financial Highlights', y);
  y = renderTable(
    doc,
    content.financialSnapshot.map((r) => [r.label, r.value]),
    y,
  );
  y += SECTION_GAP;

  // --- Counselor Resources ---
  ensureSpace(20);
  y = sectionTitle(doc, 'Counselor Resources', y);
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'normal');
  const resources = [
    'Installation Personal Financial Counselor (PFC) — check with your Family Readiness Center',
    'Military OneSource: 1-800-342-9647 / militaryonesource.mil',
    'Consumer Financial Protection Bureau — Military: consumerfinance.gov/military',
  ];
  for (const r of resources) {
    ensureSpace(LINE_H);
    doc.text(`• ${r}`, MARGIN, y);
    y += LINE_H;
  }
  y += SECTION_GAP;

  // --- Disclaimer footer ---
  ensureSpace(20);
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  const disclaimerLines = doc.splitTextToSize(content.disclaimer, CONTENT_W);
  doc.text(disclaimerLines, MARGIN, y);
  y += disclaimerLines.length * 3.5;
  doc.text(
    'This document contains sensitive financial information. Handle accordingly.',
    MARGIN, y,
  );

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, 272, { align: 'right' });
  }

  return doc;
}

export async function downloadSummaryPdf(content: PdfContent): Promise<void> {
  const doc = renderSummaryPdf(content);
  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`fortress-summary-${dateTag}.pdf`);
}

// --- Rendering helpers ---

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + doc.getTextWidth(title), y);
  return y + 4;
}

function renderTable(doc: jsPDF, rows: string[][], y: number): number {
  doc.setFontSize(9);
  const colW = CONTENT_W / 2;

  for (const [label, value] of rows) {
    if (y > 258) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(label, MARGIN, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(value, MARGIN + colW, y);
    y += LINE_H;
  }
  return y;
}

function renderFindings(doc: jsPDF, findings: PdfFinding[], y: number): number {
  for (const f of findings) {
    if (y > 245) {
      doc.addPage();
      y = MARGIN;
    }

    // Severity badge
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const badgeText = f.severity.toUpperCase();
    const badgeW = doc.getTextWidth(badgeText) + 4;
    doc.setFillColor(...severityColor(f.severity));
    doc.roundedRect(MARGIN, y - 3, badgeW, 4.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, MARGIN + 2, y);

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(f.title, MARGIN + badgeW + 3, y);
    y += LINE_H;

    // Description
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const descLines = doc.splitTextToSize(f.description, CONTENT_W - 4);
    doc.text(descLines, MARGIN + 2, y);
    y += descLines.length * 3.8;

    // Impact
    if (f.impact) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...NAVY);
      const impactLines = doc.splitTextToSize(`Impact: ${f.impact}`, CONTENT_W - 4);
      doc.text(impactLines, MARGIN + 2, y);
      y += impactLines.length * 3.8;
    }

    y += 3;
  }
  return y;
}

function renderActionPlan(doc: jsPDF, tiers: PdfActionTier[], y: number): number {
  for (const tier of tiers) {
    if (y > 250) {
      doc.addPage();
      y = MARGIN;
    }

    // Tier header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(tier.label, MARGIN, y);
    y += LINE_H;

    for (const action of tier.actions) {
      if (y > 250) {
        doc.addPage();
        y = MARGIN;
      }

      // Title + difficulty
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLACK);
      doc.text(`• ${action.title}`, MARGIN + 2, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      doc.text(
        `${action.difficulty} · ~${action.estimatedMinutes}min`,
        PAGE_W - MARGIN, y, { align: 'right' },
      );
      y += LINE_H - 1;

      // Mechanism
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const mechLines = doc.splitTextToSize(action.mechanism, CONTENT_W - 8);
      doc.text(mechLines, MARGIN + 6, y);
      y += mechLines.length * 3.8;

      // Deadline
      doc.setFontSize(7);
      doc.text(`Deadline: ${action.deadline}`, MARGIN + 6, y);
      y += LINE_H;
    }
    y += 3;
  }
  return y;
}
