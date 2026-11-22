using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Pakpost.Application;
using Pakpost.Api.Health;
using Pakpost.Infrastructure;

namespace Pakpost.Api.Extensions;

public static class PakpostHostExtensions
{
    /// <summary>Configure logging and trusted reverse proxies before the app is built.</summary>
    public static WebApplicationBuilder ConfigurePakpostHost(this WebApplicationBuilder builder)
    {
        builder.Logging.ClearProviders();
        builder.Logging.AddJsonConsole(options =>
        {
            options.IncludeScopes = true;
            options.UseUtcTimestamp = true;
            options.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
        });

        // Resolve the actual client IP for per-IP rate limiting, and HTTPS for
        // secure cookie issuance. ONLY trust explicitly configured proxy IPs.
        // Do NOT enable blanket forwarded-header trust on a public interface.
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            foreach (var entry in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
                if (IPAddress.TryParse(entry, out var ip)) options.KnownProxies.Add(ip);
        });
        return builder;
    }

    /// <summary>Register application, persistence, authentication and HTTP services.</summary>
    public static IServiceCollection AddPakpostServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddApplication();
        services.AddMediatorServices();
        services.AddInfrastructure(configuration);
        services.AddBrowserSessionAuthentication(configuration);
        services.AddWorkbenchWebServices(configuration);
        services.AddPakpostHealthChecks();
        services.AddPakpostRequestTimeouts(configuration);
        return services;
    }
}
