using Microsoft.EntityFrameworkCore;
using Pakpost.Infrastructure.Persistence;

namespace Pakpost.Api.Security;

// Expired/revoked sessions must not accumulate indefinitely in NeonDB.
public sealed class ExpiredSessionCleanupService(
    IServiceScopeFactory scopes, ILogger<ExpiredSessionCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Keep startup fast; migrations must be applied before a new build is deployed.
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        try
        {
            while (await timer.WaitForNextTickAsync(ct))
            {
                try
                {
                    using var scope = scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<PakpostDbContext>();
                    var cutoff = DateTimeOffset.UtcNow.AddDays(-1);
                    await db.UserSessions.Where(s => s.ExpiresAt < cutoff ||
                        (s.RevokedAt != null && s.RevokedAt < cutoff)).ExecuteDeleteAsync(ct);
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    logger.LogWarning(ex, "Could not clean expired browser sessions");
                }
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    }
}
