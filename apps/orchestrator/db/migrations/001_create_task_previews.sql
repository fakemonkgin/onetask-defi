BEGIN;

CREATE TABLE task_previews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intent text NOT NULL,
    network text NOT NULL DEFAULT 'anvil',
    mode text NOT NULL DEFAULT 'simulation',
    pipeline jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,

    CONSTRAINT task_previews_intent_length
        CHECK (char_length(btrim(intent)) BETWEEN 12 AND 500),

    CONSTRAINT task_previews_network
        CHECK (network = 'anvil'),

    CONSTRAINT task_previews_mode
        CHECK (mode = 'simulation'),

    CONSTRAINT task_previews_pipeline_is_array
        CHECK (jsonb_typeof(pipeline) = 'array'),

    CONSTRAINT task_previews_expiration
        CHECK (expires_at > created_at)
);

CREATE INDEX task_previews_expires_at_idx
    ON task_previews (expires_at);

COMMIT;