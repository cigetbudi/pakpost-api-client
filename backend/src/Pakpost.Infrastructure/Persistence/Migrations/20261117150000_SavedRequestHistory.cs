using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;
#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261117150000_SavedRequestHistory")]
public sealed class SavedRequestHistory:Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name:"saved_request_revisions",schema:"collection",columns:table=>new
        {
            Id=table.Column<Guid>(type:"uuid",nullable:false),
            RequestId=table.Column<Guid>(type:"uuid",nullable:false),
            Revision=table.Column<int>(type:"integer",nullable:false),
            ActorId=table.Column<Guid>(type:"uuid",nullable:false),
            Action=table.Column<string>(type:"character varying(24)",maxLength:24,nullable:false),
            encrypted_snapshot=table.Column<string>(type:"text",nullable:false),
            created_at=table.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:false)
        },constraints:table=>
        {
            table.PrimaryKey("PK_saved_request_revisions",x=>x.Id);
            table.ForeignKey("FK_saved_request_revisions_saved_requests_RequestId",x=>x.RequestId,
                principalSchema:"collection",principalTable:"saved_requests",principalColumn:"Id",onDelete:ReferentialAction.Cascade);
        });
        migrationBuilder.CreateIndex(name:"IX_saved_request_revisions_RequestId_Revision",schema:"collection",
            table:"saved_request_revisions",columns:new[]{"RequestId","Revision"},unique:true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
        =>migrationBuilder.DropTable(name:"saved_request_revisions",schema:"collection");
}
