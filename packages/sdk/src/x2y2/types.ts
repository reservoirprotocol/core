export type OrderKind = "single-token";

export enum Intent {
  SELL = 1,
  AUCTION = 2,
  BUY = 3,
}

export enum DelegationType {
  INVALID,
  ERC721,
  ERC1155,
}

export enum SignatureVersion {
  SIGN_V1 = 1,
  SIGN_V3 = 3,
}

export type OrderItem = {
  price: string;
  data: string;
};

export type Order = {
  kind?: OrderKind;
  salt: string;
  user: string;
  network: number;
  intent: Intent;
  delegateType: DelegationType;
  deadline: number;
  currency: string;
  dataMask: string;
  items: OrderItem[];
  r?: string;
  s?: string;
  v?: number;
  signVersion?: SignatureVersion;
};

export type Fee = {
  percentage: number;
  to: string;
};

export enum MarketOp {
  INVALID,
  COMPLETE_SELL_OFFER,
  COMPLETE_BUY_OFFER,
  CANCEL_OFFER,
  BID,
  COMPLETE_AUCTION,
  REFUND_AUCTION,
  REFUND_AUCTION_STUCK_ITEM,
}

export type SettleDetail = {
  op: MarketOp;
  orderIdx: number;
  itemIdx: number;
  price: string;
  itemHash: string;
  executionDelegate: string;
  dataReplacement: string;
  bidIncentivePct: number;
  aucMinIncrementPct: number;
  aucIncDurationSecs: number;
  fees: Fee[];
};

export type SettleShared = {
  salt: string;
  deadline: number;
  amountToEth: string;
  amountToWeth: string;
  user: string;
  canFail: boolean;
};

export enum InventoryStatus {
  NEW,
  AUCTION,
  COMPLETE,
  CANCELLED,
  REFUNDED,
}
