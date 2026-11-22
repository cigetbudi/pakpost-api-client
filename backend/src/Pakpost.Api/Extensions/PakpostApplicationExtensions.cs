using Microsoft.AspNetCore.Http.Timeouts;
using Pakpost.Api.Health;
using Pakpost.Api.Middlewares;
using Pakpost.Api.Realtime;
using Pakpost.Api.Security;
using Pakpost.Infrastructure.Services;

namespace Pakpost.Api.Extensions;

public static class PakpostApplicationExtensions
{
    /// <summary>
    /// Security-sensitive ordering. Do not reorder CORS, authentication, CSRF/session
    /// checks, authorization, or request middleware without an integration test.
    /// </summary>
    public static WebApplication UsePakpostRequestPipeline(this WebApplication app)
    {
        app.UseForwardedHeaders();

        // Fail startup if workspace encryption is not configured.
        _ = app.Services.GetRequiredService<WorkspaceCryptography>();

        app.UseMiddleware<RequestCorrelationMiddleware>();
        app.UseMiddleware<RequestLoggingMiddleware>();
        app.UseMiddleware<GlobalExceptionMiddleware>();
        app.UseRouting();
        app.UseRequestTimeouts();
        app.UseCors("Frontend");
        app.UseRateLimiter();
        app.UseMiddleware<PrivateApiCacheMiddleware>();
        app.UseMiddleware<ProxyConcurrencyMiddleware>();
        app.UseAuthentication();
        app.UseMiddleware<BrowserSessionSecurityMiddleware>();
        app.UseAuthorization();
        return app;
    }

    public static WebApplication MapPakpostEndpoints(this WebApplication app)
    {
        app.MapControllers();
        app.MapHub<WorkspaceHub>("/hubs/workspace", options =>
            options.CloseOnAuthenticationExpiration = true).DisableRequestTimeout();
        app.MapPakpostHealthChecks();
        return app;
    }
}
