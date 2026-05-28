import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PDF_CAPTURE_WIDTH = 794;

/** Capture un nœud DOM et télécharge un PDF A4 multi-pages. */
export async function downloadNodeAsPdf(node: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureCanvas(node);
  const pdf = addCanvasToPdf(new jsPDF("p", "mm", "a4"), canvas, { newDocument: true });
  stampPageNumbers(pdf);
  pdf.save(filename);
}

/** Capture chaque section `[data-pdf-section]` séparément pour des pages propres. */
export async function downloadSectionsAsPdf(container: HTMLElement, filename: string): Promise<void> {
  const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-section]"));
  if (!sections.length) throw new Error("Aucune section PDF à exporter");

  let pdf: jsPDF | null = null;

  for (const section of sections) {
    const canvas = await captureCanvas(section);
    pdf = addCanvasToPdf(pdf ?? new jsPDF("p", "mm", "a4"), canvas, { newDocument: !pdf });
  }

  const doc = pdf ?? new jsPDF("p", "mm", "a4");
  stampPageNumbers(doc);
  doc.save(filename);
}

async function captureCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: PDF_CAPTURE_WIDTH,
    windowWidth: PDF_CAPTURE_WIDTH,
  });
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  opts: { newDocument: boolean },
): jsPDF {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 10;
  const contentWidth = pageWidth - marginX * 2;
  const contentHeight = pageHeight - marginY * 2;

  const imgData = canvas.toDataURL("image/png");
  const imgHeightMm = (canvas.height * contentWidth) / canvas.width;

  let offsetY = 0;
  let firstSlice = opts.newDocument;

  while (offsetY < imgHeightMm - 0.5) {
    if (!firstSlice) pdf.addPage();
    firstSlice = false;

    pdf.addImage(imgData, "PNG", marginX, marginY - offsetY, contentWidth, imgHeightMm);
    offsetY += contentHeight;
  }

  return pdf;
}

function stampPageNumbers(pdf: jsPDF) {
  const total = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text("Document confidentiel — Usage interne CRC", 10, pageHeight - 6);
    pdf.text(`Page ${i} / ${total}`, pageWidth - 10, pageHeight - 6, { align: "right" });
  }
}

export function buildHistoryPdfFilename(dateFrom: string, dateTo: string): string {
  const from = dateFrom || "debut";
  const to = dateTo || "fin";
  const today = new Date().toISOString().slice(0, 10);
  return `Rapport_historique_qualite_${from}_${to}_${today}.pdf`;
}
