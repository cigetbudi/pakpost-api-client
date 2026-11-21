using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261121233000_PlatformCreatorInvitations")]
public sealed class PlatformCreatorInvitations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "platform_creator_invitations", schema: "auth",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                InvitedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                Version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_platform_creator_invitations", x => x.Id);
                table.ForeignKey("FK_platform_creator_invitations_users_InvitedByUserId",
                    x => x.InvitedByUserId, principalTable: "users", principalColumn: "Id", principalSchema: "auth",
                    onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex(name: "IX_platform_creator_invitations_TokenHash",
            schema: "auth", table: "platform_creator_invitations", column: "TokenHash", unique: true);
        migrationBuilder.CreateIndex(name: "IX_platform_creator_invitations_Email_ExpiresAt",
            schema: "auth", table: "platform_creator_invitations", columns: new[] { "Email", "ExpiresAt" });
        migrationBuilder.CreateIndex(name: "IX_platform_creator_invitations_InvitedByUserId",
            schema: "auth", table: "platform_creator_invitations", column: "InvitedByUserId");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "platform_creator_invitations", schema: "auth");
}
