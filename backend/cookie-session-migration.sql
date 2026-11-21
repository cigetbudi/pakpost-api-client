START TRANSACTION;
CREATE TABLE auth.user_sessions (
    "Id" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "TokenHash" character varying(64) NOT NULL,
    "CsrfHash" character varying(64) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "RevokedAt" timestamp with time zone,
    CONSTRAINT "PK_user_sessions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_user_sessions_users_UserId" FOREIGN KEY ("UserId") REFERENCES auth.users ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "IX_user_sessions_TokenHash" ON auth.user_sessions ("TokenHash");

CREATE INDEX "IX_user_sessions_UserId" ON auth.user_sessions ("UserId");

CREATE INDEX "IX_user_sessions_ExpiresAt" ON auth.user_sessions ("ExpiresAt");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261120160000_ServerSideBrowserSessions', '10.0.15');

COMMIT;

