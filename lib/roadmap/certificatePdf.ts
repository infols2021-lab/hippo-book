import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function buildRoadmapCertificatePdf(input: {
  userName: string;
  courseTitle: string;
  completedAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(0.06, 0.09, 0.16),
    borderWidth: 2,
  });

  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: rgb(0.02, 0.45, 0.63),
    borderWidth: 1,
  });

  const title = "Сертификат о прохождении курса";
  const titleWidth = fontBold.widthOfTextAtSize(title, 28);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 120,
    size: 28,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16),
  });

  const subtitle = "Настоящим подтверждается, что";
  const subtitleWidth = fontRegular.widthOfTextAtSize(subtitle, 14);
  page.drawText(subtitle, {
    x: (width - subtitleWidth) / 2,
    y: height - 170,
    size: 14,
    font: fontRegular,
    color: rgb(0.25, 0.32, 0.41),
  });

  const userName = input.userName.trim() || "Участник";
  const nameWidth = fontBold.widthOfTextAtSize(userName, 32);
  page.drawText(userName, {
    x: (width - nameWidth) / 2,
    y: height - 220,
    size: 32,
    font: fontBold,
    color: rgb(0.02, 0.45, 0.63),
  });

  const courseLine = `успешно завершил(а) roadmap-курс «${input.courseTitle.trim() || "Курс"}»`;
  const courseWidth = fontRegular.widthOfTextAtSize(courseLine, 16);
  page.drawText(courseLine, {
    x: (width - courseWidth) / 2,
    y: height - 270,
    size: 16,
    font: fontRegular,
    color: rgb(0.06, 0.09, 0.16),
  });

  const dateText = `Дата: ${input.completedAt.toLocaleDateString("ru-RU")}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateText, 12);
  page.drawText(dateText, {
    x: (width - dateWidth) / 2,
    y: 80,
    size: 12,
    font: fontRegular,
    color: rgb(0.39, 0.45, 0.53),
  });

  const brand = "skilLS · Hippo Book";
  const brandWidth = fontBold.widthOfTextAtSize(brand, 11);
  page.drawText(brand, {
    x: (width - brandWidth) / 2,
    y: 56,
    size: 11,
    font: fontBold,
    color: rgb(0.39, 0.45, 0.53),
  });

  return pdf.save();
}
