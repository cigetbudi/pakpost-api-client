using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261120120000_RequestManualSortOrder")]
public sealed class RequestManualSortOrder : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(name: "sort_order", schema: "collection",
            table: "saved_requests", type: "integer", nullable: false,
            defaultValue: int.MaxValue);
        // Preserve the existing alphabetical request order on first upgrade.
        migrationBuilder.Sql("""
            WITH ranked AS (
                SELECT "Id", ROW_NUMBER() OVER
                  (PARTITION BY "CollectionId", "FolderId" ORDER BY "Name", "Id") AS ord
                FROM collection.saved_requests
            )
            UPDATE collection.saved_requests AS req SET sort_order = ranked.ord
            FROM ranked WHERE req."Id" = ranked."Id";
            """);
        migrationBuilder.CreateIndex(
            name: "IX_saved_requests_CollectionId_FolderId_SortOrder_Id",
            schema: "collection", table: "saved_requests",
            columns: new[] { "CollectionId", "FolderId", "sort_order", "Id" });
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_saved_requests_CollectionId_FolderId_SortOrder_Id",
            schema: "collection", table: "saved_requests");
        migrationBuilder.DropColumn(name: "sort_order", schema: "collection", table: "saved_requests");
    }
}
