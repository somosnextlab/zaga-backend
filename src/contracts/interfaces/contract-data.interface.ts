export type ContractDataSubject = 'TITULAR' | 'CODEUDOR';
export type ContractDataTokenStatus = 'PENDING' | 'USED' | 'EXPIRED';
export type BankAccountKind = 'CBU' | 'CVU';
export type GuarantorFollowUpLevel = 'CONOCIDO' | 'FAMILIAR' | 'PROFESIONAL';

export interface ContractDataTokenRow {
  readonly id: string;
  readonly case_id: string;
  readonly subject: ContractDataSubject;
  readonly token: string;
  readonly status: ContractDataTokenStatus;
  readonly expires_at: Date;
  readonly used_at: Date | null;
  readonly created_at: Date;
}

export interface BankAccountRow {
  readonly id: string;
  readonly user_id: string;
  readonly account_kind: BankAccountKind;
  readonly cbu_cvu: string;
  readonly alias: string | null;
  readonly bank_name: string;
  readonly is_active: boolean;
}

export interface SaveTitularContractDataInput {
  readonly subject: 'TITULAR';
  readonly caseId: string;
  readonly token: string;
  readonly email: string;
  readonly account_kind: BankAccountKind;
  readonly cbu_cvu: string;
  readonly alias?: string;
  readonly bank_name: string;
  readonly domicilio_calle: string;
  readonly domicilio_numero: string;
  readonly domicilio_piso?: string;
  readonly domicilio_depto?: string;
  readonly domicilio_localidad: string;
  readonly domicilio_provincia: string;
  readonly domicilio_cp: string;
}

export interface SaveCodeudorContractDataInput {
  readonly subject: 'CODEUDOR';
  readonly caseId: string;
  readonly token: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly dni: string;
  readonly email: string;
  readonly phone?: string;
  readonly domicilio_calle: string;
  readonly domicilio_numero: string;
  readonly domicilio_piso?: string;
  readonly domicilio_depto?: string;
  readonly domicilio_localidad: string;
  readonly domicilio_provincia: string;
  readonly domicilio_cp: string;
  readonly follow_up_level: GuarantorFollowUpLevel;
}

export type SaveContractDataInput =
  | SaveTitularContractDataInput
  | SaveCodeudorContractDataInput;

export interface ContractDataTokenResult {
  readonly subject: ContractDataSubject;
  readonly token: string;
  readonly expires_at: Date;
}

export type ContractDataBusinessError = {
  readonly ok: false;
  readonly error_type: 'BUSINESS';
  readonly error_code: string;
};

export type InitiateDataCollectionResult =
  | ContractDataBusinessError
  | {
      readonly ok: true;
      readonly case_id: string;
      readonly tokens: ContractDataTokenResult[];
    };

export type SubmitContractDataResult =
  | ContractDataBusinessError
  | {
      readonly ok: true;
      readonly case_id: string;
      readonly subject: ContractDataSubject;
      readonly data_collection_completed: boolean;
    };
