using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;
#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261116183000_WorkspaceInvitations")]
public sealed class WorkspaceInvitations:Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name:"workspace_invitations",schema:"organization",
            columns:t=>new
            {
                Id=t.Column<Guid>(type:"uuid",nullable:false),
                WorkspaceId=t.Column<Guid>(type:"uuid",nullable:false),
                InvitedByUserId=t.Column<Guid>(type:"uuid",nullable:false),
                Email=t.Column<string>(type:"character varying(255)",maxLength:255,nullable:false),
                RolesJson=t.Column<string>(type:"jsonb",nullable:false),
                TokenHash=t.Column<string>(type:"character varying(64)",maxLength:64,nullable:false),
                CreatedAt=t.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:false),
                SentAt=t.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:false),
                ExpiresAt=t.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:false),
                AcceptedAt=t.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:true),
                RevokedAt=t.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:true),
                Version=t.Column<int>(type:"integer",nullable:false,defaultValue:1)
            },constraints:t=>
            {
                t.PrimaryKey("PK_workspace_invitations",x=>x.Id);
                t.ForeignKey("FK_workspace_invitations_workspaces_WorkspaceId",x=>x.WorkspaceId,
                    principalSchema:"organization",principalTable:"workspaces",principalColumn:"Id",onDelete:ReferentialAction.Cascade);
                t.ForeignKey("FK_workspace_invitations_users_InvitedByUserId",x=>x.InvitedByUserId,
                    principalSchema:"auth",principalTable:"users",principalColumn:"Id",onDelete:ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_workspace_invitations_TokenHash","workspace_invitations","TokenHash",schema:"organization",unique:true);
        migrationBuilder.CreateIndex("IX_workspace_invitations_WorkspaceId_Email","workspace_invitations",new[]{"WorkspaceId","Email"},schema:"organization");
        migrationBuilder.CreateIndex("IX_workspace_invitations_InvitedByUserId","workspace_invitations","InvitedByUserId",schema:"organization");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
        =>migrationBuilder.DropTable("workspace_invitations",schema:"organization");
}
