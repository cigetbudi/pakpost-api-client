using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Pakpost.Api.Health;

public static class HealthServiceExtensions
{
    public static IServiceCollection AddPakpostHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<PostgresReadinessCheck>("postgres", tags: ["ready"]);

        return services;
    }

    public static IEndpointRouteBuilder MapPakpostHealthChecks(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false,
            ResponseWriter = WriteMinimalStatusAsync
        }).AllowAnonymous();

        endpoints.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains("ready"),
            ResponseWriter = WriteMinimalStatusAsync
        }).RequireRateLimiting("health-readiness").AllowAnonymous();

        endpoints.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            service = "pakpost-api",
            mode = "anonymous-tester-with-private-workspaces"
        })).AllowAnonymous();

        return endpoints;
    }

    private static Task WriteMinimalStatusAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        context.Response.Headers.CacheControl = "no-store";
        return JsonSerializer.SerializeAsync(context.Response.Body,
            new { status = report.Status == HealthStatus.Healthy ? "healthy" : "unavailable" },
            cancellationToken: context.RequestAborted);
    }
}
