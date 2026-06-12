import { Injectable } from '@nestjs/common';
import { DbClient } from '../../db/db.service';
import { GuarantorFollowUpLevel } from '../interfaces/contract-data.interface';

interface CaseForContractDataRow {
  readonly id: string;
  readonly status: string;
  readonly requires_guarantor: boolean;
  readonly user_id: string;
  readonly current_offer_id: string | null;
}

interface ActiveGuarantorRow {
  readonly id: string;
  readonly user_id: string | null;
  readonly cuit: string;
  readonly first_name: string | null;
  readonly last_name: string | null;
}

interface UpdateUserContractDataInput {
  readonly userId: string;
  readonly email: string;
  readonly domicilioCalle: string;
  readonly domicilioNumero: string;
  readonly domicilioPiso?: string | null;
  readonly domicilioDepto?: string | null;
  readonly domicilioLocalidad: string;
  readonly domicilioProvincia: string;
  readonly domicilioCp: string | null;
}

interface UpdateGuarantorContractDataInput {
  readonly guarantorId: string;
  readonly dni: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly domicilioCalle: string;
  readonly domicilioNumero: string;
  readonly domicilioPiso?: string | null;
  readonly domicilioDepto?: string | null;
  readonly domicilioLocalidad: string;
  readonly domicilioProvincia: string;
  readonly domicilioCp: string | null;
  readonly followUpLevel: GuarantorFollowUpLevel;
}

@Injectable()
export class ContractDataRepository {
  public async findCaseForContractDataForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<CaseForContractDataRow | null> {
    const result = await client.query<CaseForContractDataRow>(
      `
      SELECT c.id, c.status, c.requires_guarantor, c.user_id, c.current_offer_id
      FROM cases c
      WHERE c.id = $1
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  public async findActiveGuarantorByCaseId(
    client: DbClient,
    caseId: string,
  ): Promise<ActiveGuarantorRow | null> {
    const result = await client.query<ActiveGuarantorRow>(
      `
      SELECT cg.id, cg.user_id, cg.cuit, cg.first_name, cg.last_name
      FROM case_guarantors cg
      WHERE cg.case_id = $1
        AND cg.status = 'APPROVED'
      ORDER BY cg.attempt_no DESC
      LIMIT 1
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  public async updateUserContractData(
    client: DbClient,
    input: UpdateUserContractDataInput,
  ): Promise<void> {
    await client.query(
      `
      UPDATE users
      SET email = $1,
          domicilio_calle = $2,
          domicilio_numero = $3,
          domicilio_piso = $4,
          domicilio_depto = $5,
          domicilio_localidad = $6,
          domicilio_provincia = $7,
          domicilio_cp = $8
      WHERE id = $9
      `,
      [
        input.email,
        input.domicilioCalle,
        input.domicilioNumero,
        input.domicilioPiso ?? null,
        input.domicilioDepto ?? null,
        input.domicilioLocalidad,
        input.domicilioProvincia,
        input.domicilioCp,
        input.userId,
      ],
    );
  }

  public async updateGuarantorContractData(
    client: DbClient,
    input: UpdateGuarantorContractDataInput,
  ): Promise<void> {
    await client.query(
      `
      UPDATE case_guarantors
      SET dni = $1,
          email = $2,
          phone = $3,
          domicilio_calle = $4,
          domicilio_numero = $5,
          domicilio_piso = $6,
          domicilio_depto = $7,
          domicilio_localidad = $8,
          domicilio_provincia = $9,
          domicilio_cp = $10,
          follow_up_level = $11,
          contract_data_collected_at = now()
      WHERE id = $12
      `,
      [
        input.dni,
        input.email,
        input.phone ?? null,
        input.domicilioCalle,
        input.domicilioNumero,
        input.domicilioPiso ?? null,
        input.domicilioDepto ?? null,
        input.domicilioLocalidad,
        input.domicilioProvincia,
        input.domicilioCp,
        input.followUpLevel,
        input.guarantorId,
      ],
    );
  }

  public async setCasePendingContractData(
    client: DbClient,
    caseId: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE cases
      SET status = 'PENDING_CONTRACT_DATA'
      WHERE id = $1
      `,
      [caseId],
    );
  }

  public async setCaseContractDataCompleted(
    client: DbClient,
    caseId: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE cases
      SET status = 'CONTRACT_DATA_COMPLETED',
          contract_data_completed_at = now()
      WHERE id = $1
      `,
      [caseId],
    );
  }

  public async findTasamoratoriaByOfferId(
    client: DbClient,
    offerId: string,
  ): Promise<number | null> {
    const result = await client.query<{ tasa_moratoria: number | null }>(
      `
      SELECT tasa_moratoria
      FROM case_offers
      WHERE id = $1
      `,
      [offerId],
    );
    return result.rows[0]?.tasa_moratoria ?? null;
  }
}
