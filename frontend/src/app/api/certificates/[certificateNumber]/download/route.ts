import { NextRequest, NextResponse } from "next/server";
import { environment } from "@/config/environment";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateNumber: string }> }
) {
  const { certificateNumber } = await context.params;
  const primaryApi = process.env.INTERNAL_API_URL || environment.apiUrl;
  const backupApi = environment.backupApiUrl;

  const candidateUrls: string[] = [
    `${primaryApi.replace(/\/+$/, "")}/api/certificates/${certificateNumber}/download`,
  ];
  if (backupApi && backupApi !== primaryApi) {
    candidateUrls.push(
      `${backupApi.replace(/\/+$/, "")}/api/certificates/${certificateNumber}/download`
    );
  }

  let lastStatus = 502;
  let lastErrorMessage = "Failed to connect to backend certificate service";

  for (const backendUrl of candidateUrls) {
    try {
      const backendRes = await fetch(backendUrl);

      if (!backendRes.ok) {
        lastStatus = backendRes.status;
        lastErrorMessage = "Certificate not found on server";
        continue;
      }

      const pdfBuffer = await backendRes.arrayBuffer();
      const contentType = backendRes.headers.get("content-type") || "application/pdf";
      const disposition =
        backendRes.headers.get("content-disposition") ||
        `inline; filename="Medicaps_Certificate_${certificateNumber}.pdf"`;

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": disposition,
        },
      });
    } catch (error) {
      console.warn(`Certificate download failed from ${backendUrl}, attempting backup...`, error);
    }
  }

  return new NextResponse(
    JSON.stringify({ error: lastErrorMessage }),
    { status: lastStatus, headers: { "Content-Type": "application/json" } }
  );
}

