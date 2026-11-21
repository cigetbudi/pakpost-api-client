using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261121100000_AccountSessionHardening")]
public sealed class AccountSessionHardening : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "UserAgent", table: "user_sessions", schema: "auth",
            type: "character varying(256)", maxLength: 256, nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<string>(name: "AvatarUrl", table: "user_sessions", schema: "auth",
            type: "character varying(2048)", maxLength: 2048, nullable: true);
        migrationBuilder.AddColumn<bool>(name: "IsDisabled", table: "users", schema: "auth",
            type: "boolean", nullable: false, defaultValue: false);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "UserAgent", table: "user_sessions", schema: "auth");
        migrationBuilder.DropColumn(name: "AvatarUrl", table: "user_sessions", schema: "auth");
        migrationBuilder.DropColumn(name: "IsDisabled", table: "users", schema: "auth");
    }
}
