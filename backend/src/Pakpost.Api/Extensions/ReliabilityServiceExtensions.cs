using Microsoft.AspNetCore.Http.Timeouts;

namespace Pakpost.Api.Extensions;

public static class ReliabilityServiceExtensions
{
    public static IServiceCollection AddPakpostRequestTimeouts(this IServiceCollection services, IConfiguration configuration)
    {
        var generalSeconds = Math.Clamp(configuration.GetValue("RequestTimeout:DefaultSeconds", 90), 10, 300);
        var authSeconds = Math.Clamp(configuration.GetValue("RequestTimeout:AuthSeconds", 30), 5, 120);
        var proxySeconds = Math.Clamp(configuration.GetValue("RequestTimeout:ProxySeconds", 25), 5, 120);

        services.AddRequestTimeouts(options =>
        {
            options.DefaultPolicy = BuildTimeoutPolicy(generalSeconds);
            options.AddPolicy("auth", BuildTimeoutPolicy(authSeconds));
            options.AddPolicy("proxy", BuildTimeoutPolicy(proxySeconds));
        });

        return services;
    }

    private static RequestTimeoutPolicy BuildTimeoutPolicy(int seconds) => new()
    {
        Timeout = TimeSpan.FromSeconds(seconds),
        TimeoutStatusCode = StatusCodes.Status504GatewayTimeout,
        WriteTimeoutResponse = async context =>
        {
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"message\":\"Request timed out\"}");
        }
    };
}
