using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable

namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261118220000_WorkspaceEnvelopeEncryption")]
public sealed class WorkspaceEnvelopeEncryption : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "DO $$ BEGIN " +
            "IF EXISTS (SELECT 1 FROM organization.workspaces) THEN " +
            "RAISE EXCEPTION 'Workspace encryption requires empty workspaces; migrate existing data separately'; " +
            "END IF; END $$;");

        migrationBuilder.CreateTable(
            name: "workspace_encryption_keys",
            schema: "organization",
            columns: table => new
            {
                WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                KeyVersion = table.Column<int>(type: "integer", nullable: false),
                MasterKeyId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                WrappedKey = table.Column<string>(type: "text", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_workspace_encryption_keys", key => key.WorkspaceId);
                table.ForeignKey(
                    "FK_workspace_encryption_keys_workspaces_WorkspaceId",
                    key => key.WorkspaceId,
                    principalSchema: "organization",
                    principalTable: "workspaces",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.AlterColumn<string>(
            name: "Url",
            schema: "collection",
            table: "saved_requests",
            type: "text",
            nullable: false,
            oldClrType: typeof(string),
            oldType: "character varying(2048)",
            oldMaxLength: 2048);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "DO $$ BEGIN " +
            "IF EXISTS (SELECT 1 FROM organization.workspaces) THEN " +
            "RAISE EXCEPTION 'Cannot roll back workspace encryption while Workspace data exists'; " +
            "END IF; END $$;");

        migrationBuilder.AlterColumn<string>(
            name: "Url",
            schema: "collection",
            table: "saved_requests",
            type: "character varying(2048)",
            maxLength: 2048,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "text");

        migrationBuilder.DropTable(
            name: "workspace_encryption_keys",
            schema: "organization");
    }
}
