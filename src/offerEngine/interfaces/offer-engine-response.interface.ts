export interface ScheduleItem {
  installment_number: number;
  opening_balance: number;
  interest: number;
  vat: number;
  amortization: number;
  base_installment: number;
  gross_installment: number;
  closing_balance: number;
  due_date: string | null;
}

export interface CaseOfferPayload {
  offer_id: string;
  case_id: string;
  version: number;
  requires_guarantor: boolean;
  amount: number;
  installments: number;
  payment_periodicity: string;
  payment_amount: number;
  tasa_nominal_anual: number;
  tea: number;
  cftna: number;
  cftea: number;
  total_interest: number;
  total_vat: number;
  total_payable: number;
  cfto_amount: number;
  cfto_percent: number;
  pricing_engine_version: string;
  schedule: ScheduleItem[];
}

export interface CreateCaseOfferResponse {
  ok: true;
  offer: CaseOfferPayload;
}
