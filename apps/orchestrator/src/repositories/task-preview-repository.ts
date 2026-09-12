import type { Pool } from "pg";

export type CreateTaskPreviewInput = {
  intent: string;
  pipeline: readonly string[];
  expiresAt: Date;
};

export type TaskPreviewRecord = {
  id: string;
  intent: string;
  network: "anvil";
  mode: "simulation";
  pipeline: readonly string[];
  createdAt: Date;
  expiresAt: Date;
};

type TaskPreviewRow = {
  id: string;
  intent: string;
  network: "anvil";
  mode: "simulation";
  pipeline: string[];
  created_at: Date;
  expires_at: Date;
};

export class TaskPreviewRepository {
  constructor(private readonly pool: Pool) {}

  async create(
    input: CreateTaskPreviewInput,
  ): Promise<TaskPreviewRecord> {
    const result = await this.pool.query<TaskPreviewRow>(
      `
        INSERT INTO task_previews (
          intent,
          pipeline,
          expires_at
        )
        VALUES ($1, $2::jsonb, $3)
        RETURNING
          id,
          intent,
          network,
          mode,
          pipeline,
          created_at,
          expires_at
      `,
      [
        input.intent,
        JSON.stringify(input.pipeline),
        input.expiresAt,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "PostgreSQL did not return the created task preview.",
      );
    }

    return {
      id: row.id,
      intent: row.intent,
      network: row.network,
      mode: row.mode,
      pipeline: row.pipeline,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }
}