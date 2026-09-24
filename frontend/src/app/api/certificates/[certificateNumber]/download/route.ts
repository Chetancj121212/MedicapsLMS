import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateNumber: string }> }
) {
  const { certificateNumber } = await context.params;
  const backendUrl = `http://localhost:8000/api/certificates/${certificateNumber}/download`;

  try {
    const backendRes = await fetch(backendUrl);

    if (!backendRes.ok) {
      return new NextResponse(
        JSON.stringify({ error: "Certificate not found on server" }),
        { status: backendRes.status, headers: { "Content-Type": "application/json" } }
      );
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
    console.error("Error proxying certificate download:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to connect to backend certificate service" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
