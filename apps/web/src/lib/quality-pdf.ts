import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PDF_CAPTURE_WIDTH = 794;

/** Capture un nœud DOM et télécharge un PDF A4 multi-pages. */
export async function downloadNodeAsPdf(node: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: PDF_CAPTURE_WIDTH,
    windowWidth: PDF_CAPTURE_WIDTH,
  });
  addCanvasToPdf(new jsPDF("p", "mm", "a4"), canvas, { newDocument: true }).save(filename);
}

/** Capture chaque section `[data-pdf-section]` séparément pour des pages propres. */
export async function downloadSectionsAsPdf(container: HTMLElement, filename: string): Promise<void> {
  const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-pdf-section]"));
  if (!sections.length) throw new Error("Aucune section PDF à exporter");

  let pdf: jsPDF | null = null;

  for (const section of sections) {
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: PDF_CAPTURE_WIDTH,
      windowWidth: PDF_CAPTURE_WIDTH,
    });

    pdf = addCanvasToPdf(pdf ?? new jsPDF("p", "mm", "a4"), canvas, { newDocument: !pdf });
  }

  (pdf ?? new jsPDF("p", "mm", "a4")).save(filename);
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  opts: { newDocument: boolean },
): jsPDF {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 8;
  const marginY = 8;
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

export function buildHistoryPdfFilename(dateFrom: string, dateTo: string): string {
  const from = dateFrom || "debut";
  const to = dateTo || "fin";
  const today = new Date().toISOString().slice(0, 10);
  return `qualite-historique_${from}_${to}_${today}.pdf`;
}
