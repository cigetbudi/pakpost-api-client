using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Pakpost.Infrastructure.Persistence;

#nullable disable
namespace Pakpost.Infrastructure.Persistence.Migrations;
[DbContext(typeof(PakpostDbContext))]
[Migration("20261117130000_RequestRevision")]
public sealed class RequestRevision : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
        => migrationBuilder.AddColumn<int>(name:"revision",schema:"collection",table:"saved_requests",
            type:"integer",nullable:false,defaultValue:1);
    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropColumn(name:"revision",schema:"collection",table:"saved_requests");
}

