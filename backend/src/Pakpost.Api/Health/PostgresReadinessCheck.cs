using System.Data;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Health;

public sealed class PostgresReadinessCheck(
    PakpostDbContext database,
    IConfiguration configuration) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var watch = Stopwatch.StartNew();
        var timeoutSeconds = Math.Clamp(
            configuration.GetValue("Database:HealthTimeoutSeconds", 4), 1, 15);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                var connection = database.Database.GetDbConnection();
                try
                {
                    await connection.OpenAsync(timeout.Token);
                    await using var command = connection.CreateCommand();
                    command.CommandText = "SELECT 1";
                    command.CommandTimeout = timeoutSeconds;

                    var result = await command.ExecuteScalarAsync(timeout.Token);
                    if (Convert.ToInt32(result) != 1)
                        return HealthCheckResult.Unhealthy("PostgreSQL readiness probe returned an unexpected result");

                    return HealthCheckResult.Healthy(
                        "PostgreSQL is responding",
                        new Dictionary<string, object> { ["latencyMs"] = watch.ElapsedMilliseconds });
                }
                finally
                {
                    if (connection.State != ConnectionState.Closed)
                        await connection.CloseAsync();
                }
            }
            catch (Exception ex) when (attempt == 0 && !timeout.IsCancellationRequested &&
                                       (ex is TimeoutException or NpgsqlException { IsTransient: true }))
            {
                await Task.Delay(TimeSpan.FromMilliseconds(150), timeout.Token);
            }
            catch (Exception ex) when (ex is NpgsqlException or TimeoutException or OperationCanceledException)
            {
                return HealthCheckResult.Unhealthy("PostgreSQL is unavailable");
            }
        }

        return HealthCheckResult.Unhealthy("PostgreSQL is unavailable");
    }
}
