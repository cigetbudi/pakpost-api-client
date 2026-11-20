using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable

namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261120100000_CollectionHierarchy")]
public sealed class CollectionHierarchy : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(name:"parent_collection_id",schema:"collection",table:"collections",
            type:"uuid",nullable:true);
        migrationBuilder.AddColumn<int>(name:"sort_order",schema:"collection",table:"collections",
            type:"integer",nullable:false,defaultValue:0);
        migrationBuilder.CreateIndex(name:"IX_collections_parent_collection_id",
            schema:"collection",table:"collections",column:"parent_collection_id");
        migrationBuilder.CreateIndex(name:"IX_collections_WorkspaceId_ParentCollectionId_SortOrder",
            schema:"collection",table:"collections",columns:new[]{"WorkspaceId","parent_collection_id","sort_order"});
        migrationBuilder.AddForeignKey(name:"FK_collections_collections_parent_collection_id",
            schema:"collection",table:"collections",column:"parent_collection_id",
            principalSchema:"collection",principalTable:"collections",principalColumn:"Id",
            onDelete:ReferentialAction.Restrict);
        migrationBuilder.Sql("ALTER TABLE collection.collections ADD CONSTRAINT ck_collection_no_self_parent " +
            "CHECK (parent_collection_id IS NULL OR parent_collection_id <> \"Id\")");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Do not silently discard a hierarchy that users already organized.
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM collection.collections " +
            "WHERE parent_collection_id IS NOT NULL) THEN " +
            "RAISE EXCEPTION 'Flatten collections before rolling back CollectionHierarchy'; " +
            "END IF; END $$;");
        migrationBuilder.Sql("ALTER TABLE collection.collections DROP CONSTRAINT IF EXISTS ck_collection_no_self_parent");
        migrationBuilder.DropForeignKey(name:"FK_collections_collections_parent_collection_id",
            schema:"collection",table:"collections");
        migrationBuilder.DropIndex(name:"IX_collections_parent_collection_id",schema:"collection",table:"collections");
        migrationBuilder.DropIndex(name:"IX_collections_WorkspaceId_ParentCollectionId_SortOrder",
            schema:"collection",table:"collections");
        migrationBuilder.DropColumn(name:"parent_collection_id",schema:"collection",table:"collections");
        migrationBuilder.DropColumn(name:"sort_order",schema:"collection",table:"collections");
    }
}
