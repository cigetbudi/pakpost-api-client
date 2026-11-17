using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;
#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261117200000_NativeCloudFolders")]
public sealed class NativeCloudFolders : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(name:"collection_folders",schema:"collection",columns:t=>new
        {
            Id=t.Column<Guid>(type:"uuid",nullable:false),
            CollectionId=t.Column<Guid>(type:"uuid",nullable:false),
            parent_folder_id=t.Column<Guid>(type:"uuid",nullable:true),
            Name=t.Column<string>(type:"character varying(120)",maxLength:120,nullable:false),
            version=t.Column<int>(type:"integer",nullable:false,defaultValue:1),
            CreatedAt=t.Column<DateTimeOffset>(type:"timestamp with time zone",nullable:false)
        },constraints:t=>
        {
            t.PrimaryKey("PK_collection_folders",x=>x.Id);
            t.ForeignKey("FK_collection_folders_collections_CollectionId",x=>x.CollectionId,
                principalSchema:"collection",principalTable:"collections",principalColumn:"Id",onDelete:ReferentialAction.Cascade);
            t.ForeignKey("FK_collection_folders_collection_folders_parent_folder_id",x=>x.parent_folder_id,
                principalSchema:"collection",principalTable:"collection_folders",principalColumn:"Id",onDelete:ReferentialAction.NoAction);
        });
        // EF Core's FK index convention also creates this single-column index.
        // The (CollectionId, parent_folder_id) composite index cannot replace it,
        // because parent_folder_id is not the leading column.
        migrationBuilder.CreateIndex(name:"IX_collection_folders_parent_folder_id",schema:"collection",table:"collection_folders",column:"parent_folder_id");
        migrationBuilder.CreateIndex(name:"IX_collection_folders_CollectionId_parent_folder_id",schema:"collection",table:"collection_folders",columns:new[]{"CollectionId","parent_folder_id"});
        migrationBuilder.CreateIndex(name:"IX_collection_folders_CollectionId_Name",schema:"collection",table:"collection_folders",columns:new[]{"CollectionId","Name"},unique:true,filter:"parent_folder_id IS NULL");
        migrationBuilder.CreateIndex(name:"IX_collection_folders_CollectionId_parent_folder_id_Name",schema:"collection",table:"collection_folders",columns:new[]{"CollectionId","parent_folder_id","Name"},unique:true,filter:"parent_folder_id IS NOT NULL");
        migrationBuilder.AddColumn<Guid>(name:"FolderId",schema:"collection",table:"saved_requests",type:"uuid",nullable:true);
        migrationBuilder.CreateIndex(name:"IX_saved_requests_FolderId",schema:"collection",table:"saved_requests",column:"FolderId");
        migrationBuilder.AddForeignKey(name:"FK_saved_requests_collection_folders_FolderId",schema:"collection",table:"saved_requests",column:"FolderId",
            principalSchema:"collection",principalTable:"collection_folders",principalColumn:"Id",onDelete:ReferentialAction.NoAction);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Never silently discard folder hierarchy on rollback.
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM collection.collection_folders) THEN RAISE EXCEPTION 'Cannot roll back: Cloud folders contain data'; END IF; END $$;");
        migrationBuilder.DropForeignKey(name:"FK_saved_requests_collection_folders_FolderId",schema:"collection",table:"saved_requests");
        migrationBuilder.DropIndex(name:"IX_saved_requests_FolderId",schema:"collection",table:"saved_requests");
        migrationBuilder.DropColumn(name:"FolderId",schema:"collection",table:"saved_requests");
        migrationBuilder.DropTable(name:"collection_folders",schema:"collection");
    }
}
