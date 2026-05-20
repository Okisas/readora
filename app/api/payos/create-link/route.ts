import crypto from "node:crypto";
import { NextResponse } from "next/server";

const PAYOS_API_URL = "https://api-merchant.payos.vn/v2/payment-requests";

const normalizeBaseUrl = (value?: string) => {
  if (!value) return null;

  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const createSignature = (input: {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
  checksumKey: string;
}) => {
  const rawSignature = [
    `amount=${input.amount}`,
    `cancelUrl=${input.cancelUrl}`,
    `description=${input.description}`,
    `orderCode=${input.orderCode}`,
    `returnUrl=${input.returnUrl}`,
  ].join("&");

  return crypto
    .createHmac("sha256", input.checksumKey)
    .update(rawSignature)
    .digest("hex");
};

export async function POST(request: Request) {
  try {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    const siteUrl =
      normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
      normalizeBaseUrl(request.headers.get("origin") ?? undefined);

    if (!clientId || !apiKey || !checksumKey || !siteUrl) {
      return NextResponse.json(
        {
          error:
            "PayOS chưa được cấu hình. Hãy thêm PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY và NEXT_PUBLIC_SITE_URL.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      amount?: number;
      donorName?: string;
      note?: string;
    };

    const amount = Number(body.amount);

    if (!Number.isInteger(amount) || amount < 1000) {
      return NextResponse.json(
        {
          error: "Số tiền không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const note = body.note?.trim().replace(/\s+/g, " ").slice(0, 25) || "";

    const orderCode =
      Number(`${Date.now()}`.slice(-10)) || Math.floor(Date.now() / 1000);

    const description = note || `READORA ${String(orderCode).slice(-4)}`;
    const returnUrl = `${siteUrl}/`;
    const cancelUrl = `${siteUrl}/`;

    const payload = {
      orderCode,
      amount,
      description,
      buyerName: body.donorName?.trim().slice(0, 50) || undefined,
      items: [
        {
          name: note || "Donate Readora",
          quantity: 1,
          price: amount,
        },
      ],
      cancelUrl,
      returnUrl,
      expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
      signature: createSignature({
        amount,
        cancelUrl,
        description,
        orderCode,
        returnUrl,
        checksumKey,
      }),
    };

    const payosResponse = await fetch(PAYOS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const payosPayload = (await payosResponse.json()) as {
      code?: string;
      desc?: string;
      data?: {
        checkoutUrl?: string;
        paymentLinkId?: string;
        qrCode?: string;
      };
    };

    if (!payosResponse.ok || !payosPayload?.data?.checkoutUrl) {
      return NextResponse.json(
        {
          error: payosPayload?.desc ?? "PayOS không thể tạo link thanh toán.",
          details: payosPayload,
        },
        { status: payosResponse.status || 500 },
      );
    }

    return NextResponse.json({
      checkoutUrl: payosPayload.data.checkoutUrl,
      paymentLinkId: payosPayload.data.paymentLinkId,
      qrCode: payosPayload.data.qrCode,
      orderCode,
      note: note || null,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Không thể tạo link PayOS.",
      },
      { status: 500 },
    );
  }
}
