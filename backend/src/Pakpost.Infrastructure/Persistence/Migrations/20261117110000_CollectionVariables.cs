using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261117110000_CollectionVariables")]
public sealed class CollectionVariables : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name:"variables_json",schema:"collection",table:"collections",
            type:"text",nullable:false,defaultValue:"[]");
        migrationBuilder.AddColumn<int>(name:"variables_version",schema:"collection",table:"collections",
            type:"integer",nullable:false,defaultValue:0);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name:"variables_json",schema:"collection",table:"collections");
        migrationBuilder.DropColumn(name:"variables_version",schema:"collection",table:"collections");
    }
}
