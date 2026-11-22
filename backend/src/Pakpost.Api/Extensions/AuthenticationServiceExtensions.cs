using System.Text;
using Microsoft.AspNetCore.Authentication;
using Pakpost.Api.Security;

namespace Pakpost.Api.Extensions;

public static class AuthenticationServiceExtensions
{
    // Opaque server-side session cookies are the only browser auth scheme.
    public static IServiceCollection AddBrowserSessionAuthentication(
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
