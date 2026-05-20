export type Brand = "visa" | "mastercard";

export interface Amount {
  value: string;
  currency: string;
}

export interface Merchant {
  name: string;
  url: string;
  country_code: string;
  category_code?: string;
}

export interface Agent {
  id: string;
  name: string;
  status: "active";
  enrollment_ids: string[];
  created_at: string;
}

export interface EnrollmentCard {
  brand: Brand;
  bin: string;
  last4: string;
  expiration_month: number;
  expiration_year: number;
  issuer?: { name?: string; country?: string };
  display?: { art_url?: string; background_color?: string };
}

export interface Enrollment {
  id: string;
  token_id: string;
  provider: Brand | "visa-mock" | "mastercard-mock";
  status: "pending_verification" | "active" | "suspended" | "deleted" | "failed";
  card: EnrollmentCard;
  agent_ids?: string[];
  wallet_name?: string | null;
  created_at: string;
}

export interface Instruction {
  id: string;
  enrollment_id: string;
  status:
    | "active"
    | "pending"
    | "pending_verification"
    | "approved"
    | "cancelled"
    | "expired";
  amount: Amount;
  description: string;
  expires_at: string;
  merchant?: Merchant;
  created_at: string;
}

export interface Credentials {
  card: {
    number: string;
    expiration_month: number;
    expiration_year: number;
    cvc: string;
  };
  expires_at: string;
}
