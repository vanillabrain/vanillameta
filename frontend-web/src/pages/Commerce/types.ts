export type CommerceProject = { id: string | number; name: string; [key: string]: unknown };

export type CommerceSummary = {
  paymentTotal: string;
  refundTotal: string;
  netCollected: string;
  paidOrders: number;
  refundedOrders: number;
  refundOrderRate: string | number | null;
};

export type CommerceReport = {
  project: CommerceProject;
  summary: CommerceSummary;
  daily: Array<{ date: string; paymentTotal: string; refundTotal: string; netCollected: string }>;
  channels: Array<{ channel: string; paymentTotal: string; refundTotal: string; netCollected: string }>;
  reasons: Array<{ reason: string; refundTotal: string; refunds: number }>;
  orders: Array<{
    orderId: string;
    orderedAt: string;
    channel: string;
    orderStatus: string;
    paidAmount: string;
    refundAmount: string;
    netCollected: string;
  }>;
  availableChannels: string[];
  range?: unknown;
  scope?: unknown;
};

export type CommercePresentation = { title?: string; explanation?: string; chartTitle?: string; [key: string]: unknown };
