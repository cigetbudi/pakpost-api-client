using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable

namespace Pakpost.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PakpostDbContext))]
[Migration("20261119170000_LargeCollectionPagingIndexes")]
public sealed class LargeCollectionPagingIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"IX_saved_requests_CollectionId_Id\" " +
            "ON collection.saved_requests (\"CollectionId\", \"Id\")",
            suppressTransaction: true);
        migrationBuilder.Sql(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"IX_saved_requests_CollectionId_FolderId_Id\" " +
            "ON collection.saved_requests (\"CollectionId\", \"FolderId\", \"Id\")",
            suppressTransaction: true);
        migrationBuilder.Sql(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"IX_saved_requests_CollectionId_Name_Id\" " +
            "ON collection.saved_requests (\"CollectionId\", \"Name\", \"Id\")",
            suppressTransaction: true);
        migrationBuilder.Sql(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS \"IX_saved_requests_CollectionId_FolderId_Name_Id\" " +
            "ON collection.saved_requests (\"CollectionId\", \"FolderId\", \"Name\", \"Id\")",
            suppressTransaction: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "DROP INDEX CONCURRENTLY IF EXISTS collection.\"IX_saved_requests_CollectionId_FolderId_Name_Id\"",
            suppressTransaction: true);
        migrationBuilder.Sql(
            "DROP INDEX CONCURRENTLY IF EXISTS collection.\"IX_saved_requests_CollectionId_Name_Id\"",
            suppressTransaction: true);
        migrationBuilder.Sql(
            "DROP INDEX CONCURRENTLY IF EXISTS collection.\"IX_saved_requests_CollectionId_FolderId_Id\"",
            suppressTransaction: true);
        migrationBuilder.Sql(
            "DROP INDEX CONCURRENTLY IF EXISTS collection.\"IX_saved_requests_CollectionId_Id\"",
            suppressTransaction: true);
    }
}
