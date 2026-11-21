using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261120160000_ServerSideBrowserSessions")]
public sealed class ServerSideBrowserSessions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "user_sessions", schema: "auth",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<Guid>(type: "uuid", nullable: false),
                TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                CsrfHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_user_sessions", x => x.Id);
                table.ForeignKey("FK_user_sessions_users_UserId", x => x.UserId,
                    principalTable: "users", principalColumn: "Id", principalSchema: "auth",
                    onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_user_sessions_TokenHash", schema: "auth",
            table: "user_sessions", column: "TokenHash", unique: true);
        migrationBuilder.CreateIndex(name: "IX_user_sessions_UserId", schema: "auth",
            table: "user_sessions", column: "UserId");
        migrationBuilder.CreateIndex(name: "IX_user_sessions_ExpiresAt", schema: "auth",
            table: "user_sessions", column: "ExpiresAt");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropTable(name: "user_sessions", schema: "auth");
}
