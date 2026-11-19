using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using Pakpost.Api.Health;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.IntegrationTests;

public sealed class PostgresReadinessTests
{
    [Fact]
    public async Task ReadinessProbeReturnsHealthyForDisposablePostgres()
    {
        if (Environment.GetEnvironmentVariable("PAKPOST_ALLOW_TEST_MIGRATIONS") != "YES_DISPOSABLE_DB")
            throw new InvalidOperationException("This test requires a disposable PostgreSQL database");

        var connectionString = Environment.GetEnvironmentVariable("PAKPOST_TEST_POSTGRES")
            ?? throw new InvalidOperationException("PAKPOST_TEST_POSTGRES missing");

        var databaseName = new NpgsqlConnectionStringBuilder(connectionString).Database;
        if (string.IsNullOrWhiteSpace(databaseName) ||
            !databaseName.StartsWith("pakpost_integration_", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Readiness test must use a disposable integration database");

        var options = new DbContextOptionsBuilder<PakpostDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        await using var database = new PakpostDbContext(options);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:HealthTimeoutSeconds"] = "10"
            })
            .Build();

        var check = new PostgresReadinessCheck(database, configuration);
        var result = await check.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.True(Convert.ToInt64(result.Data["latencyMs"]) >= 0);
    }
}
