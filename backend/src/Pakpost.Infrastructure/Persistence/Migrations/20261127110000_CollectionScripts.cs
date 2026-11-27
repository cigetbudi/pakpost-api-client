using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261127110000_CollectionScripts")]
public sealed class CollectionScripts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name:"scripts_json",schema:"collection",table:"collections",
            type:"text",nullable:true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM collection.collections WHERE scripts_json IS NOT NULL) THEN RAISE EXCEPTION 'Export collection scripts before rollback'; END IF; END $$;");
        migrationBuilder.DropColumn(name:"scripts_json",schema:"collection",table:"collections");
    }
}
