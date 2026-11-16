using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;
#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261116150000_WorkspaceMultiRoles")]
public sealed class WorkspaceMultiRoles:Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name:"workspace_member_roles",schema:"organization",
            columns:table=>new{
                WorkspaceId=table.Column<Guid>(type:"uuid",nullable:false),
                UserId=table.Column<Guid>(type:"uuid",nullable:false),
                Role=table.Column<string>(type:"character varying(32)",maxLength:32,nullable:false)
            },
            constraints:table=>{
                table.PrimaryKey("PK_workspace_member_roles",x=>new{x.WorkspaceId,x.UserId,x.Role});
                table.ForeignKey("FK_workspace_member_roles_workspace_members_WorkspaceId_UserId",
                    x=>new{x.WorkspaceId,x.UserId},principalSchema:"organization",
                    principalTable:"workspace_members",principalColumns:new[]{"WorkspaceId","UserId"},
                    onDelete:ReferentialAction.Cascade);
            });
        // Backfill existing sharing rights: Owner -> TeamLead; Admin -> Admin+Developer;
        // Member -> Developer. Nothing is deleted, and previously shared requests remain writable.
        migrationBuilder.Sql("""
            INSERT INTO organization.workspace_member_roles ("WorkspaceId", "UserId", "Role")
            SELECT "WorkspaceId", "UserId", 'TeamLead'
            FROM organization.workspace_members WHERE "Role"='Owner';
            INSERT INTO organization.workspace_member_roles ("WorkspaceId", "UserId", "Role")
            SELECT "WorkspaceId", "UserId", 'WorkspaceAdmin'
            FROM organization.workspace_members WHERE "Role"='Admin';
            INSERT INTO organization.workspace_member_roles ("WorkspaceId", "UserId", "Role")
            SELECT "WorkspaceId", "UserId", 'Developer'
            FROM organization.workspace_members WHERE "Role" IN ('Admin','Member');
            """);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
        =>throw new NotSupportedException(
            "RBAC downgrade requires a reviewed manual role migration. Removing roles could elevate QA/Writer to legacy Member write access.");
}
