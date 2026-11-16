using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable

namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261116103000_GoogleIdentities")]
public sealed class GoogleIdentities : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "user_external_identities",
            schema: "auth",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<Guid>(type: "uuid", nullable: false),
                Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                Subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_external_identities", x => x.Id);
                table.ForeignKey(
                    name: "FK_user_external_identities_users_UserId",
                    column: x => x.UserId,
                    principalSchema: "auth", principalTable: "users", principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(
            name: "IX_user_external_identities_Provider_Subject", schema: "auth",
            table: "user_external_identities", columns: new[] { "Provider", "Subject" }, unique: true);
        migrationBuilder.CreateIndex(
            name: "IX_user_external_identities_UserId_Provider", schema: "auth",
            table: "user_external_identities", columns: new[] { "UserId", "Provider" }, unique: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropTable(name: "user_external_identities", schema: "auth");
}
