using System.Text;
using Microsoft.AspNetCore.Authentication;
using Pakpost.Api.Security;

namespace Pakpost.Api.Extensions;

public static class AuthenticationServiceExtensions
{
    // Kept as a source-compatible registration name; the authenticated browser
    // scheme is now opaque server sessions, not JWT bearer authentication.
    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services, IConfiguration configuration)
    {
        var signingKey = configuration["Jwt:SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey) < 32)
            throw new InvalidOperationException("Jwt__SigningKey must be at least 32 UTF-8 bytes");

        services.AddScoped<ServerSessionStore>();
        services.AddHostedService<ExpiredSessionCleanupService>();
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = BrowserSessionAuthenticationHandler.SchemeName;
            options.DefaultChallengeScheme = BrowserSessionAuthenticationHandler.SchemeName;
        }).AddScheme<AuthenticationSchemeOptions, BrowserSessionAuthenticationHandler>(
            BrowserSessionAuthenticationHandler.SchemeName, _ => { });

        // No JWT bearer scheme is registered. A legacy JWT (including one that
        // remains in an old tab) cannot authenticate new cookie-protected APIs.
        return services;
    }
}
