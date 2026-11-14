using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Pakpost.Infrastructure.Persistence;
// Called by dotnet ef independently of ASP.NET startup.
public sealed class PakpostDbContextFactory : IDesignTimeDbContextFactory<PakpostDbContext>
{
    public PakpostDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Postgres");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Export ConnectionStrings__Postgres before running dotnet ef");
        var options = new DbContextOptionsBuilder<PakpostDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new PakpostDbContext(options);
    }
}
