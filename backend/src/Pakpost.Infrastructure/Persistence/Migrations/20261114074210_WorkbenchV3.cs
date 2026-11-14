using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pakpost.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WorkbenchV3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BodyMode",
                schema: "collection",
                table: "saved_requests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "raw");

            migrationBuilder.AddColumn<string>(
                name: "ContentType",
                schema: "collection",
                table: "saved_requests",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "application/json");

            migrationBuilder.AddColumn<string>(
                name: "FormFieldsJson",
                schema: "collection",
                table: "saved_requests",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "PostResponseScript",
                schema: "collection",
                table: "saved_requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PreRequestScript",
                schema: "collection",
                table: "saved_requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "request_environments",
                schema: "organization",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_request_environments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_request_environments_workspaces_WorkspaceId",
                        column: x => x.WorkspaceId,
                        principalSchema: "organization",
                        principalTable: "workspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "request_environment_variables",
                schema: "organization",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EnvironmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    StoredValue = table.Column<string>(type: "text", nullable: false),
                    IsSecret = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_request_environment_variables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_request_environment_variables_request_environments_Environm~",
                        column: x => x.EnvironmentId,
                        principalSchema: "organization",
                        principalTable: "request_environments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_request_environment_variables_EnvironmentId_Key",
                schema: "organization",
                table: "request_environment_variables",
                columns: new[] { "EnvironmentId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_request_environments_WorkspaceId_Name",
                schema: "organization",
                table: "request_environments",
                columns: new[] { "WorkspaceId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "request_environment_variables",
                schema: "organization");

            migrationBuilder.DropTable(
                name: "request_environments",
                schema: "organization");

            migrationBuilder.DropColumn(
                name: "BodyMode",
                schema: "collection",
                table: "saved_requests");

            migrationBuilder.DropColumn(
                name: "ContentType",
                schema: "collection",
                table: "saved_requests");

            migrationBuilder.DropColumn(
                name: "FormFieldsJson",
                schema: "collection",
                table: "saved_requests");

            migrationBuilder.DropColumn(
                name: "PostResponseScript",
                schema: "collection",
                table: "saved_requests");

            migrationBuilder.DropColumn(
                name: "PreRequestScript",
                schema: "collection",
                table: "saved_requests");
        }
    }
}
