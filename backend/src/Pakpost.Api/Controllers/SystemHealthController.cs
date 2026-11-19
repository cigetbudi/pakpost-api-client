using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Pakpost.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/system/health")]
public sealed class SystemHealthController(HealthCheckService healthChecks) : ControllerBase
{
    [HttpGet]
    [EnableRateLimiting("health-readiness")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var report = await healthChecks.CheckHealthAsync(
            registration => registration.Tags.Contains("ready"), cancellationToken);

        var found = report.Entries.TryGetValue("postgres", out var probe);
        var databaseHealthy = found && probe.Status == HealthStatus.Healthy;
        var latencyMs = databaseHealthy && probe.Data.TryGetValue("latencyMs", out var latency)
            ? latency : null;

        return StatusCode(databaseHealthy ? 200 : 503, new
        {
            status = databaseHealthy ? "healthy" : "degraded",
            service = "pakpost-api",
            database = new
            {
                status = databaseHealthy ? "connected" : "unavailable",
                latencyMs
            },
            checkedAtUtc = DateTimeOffset.UtcNow
        });
    }
}
