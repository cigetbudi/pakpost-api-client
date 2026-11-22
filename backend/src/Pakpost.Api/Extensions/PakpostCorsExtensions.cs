namespace Pakpost.Api.Extensions;

public static class PakpostCorsExtensions
{
    /// <summary>Allow only configured frontend origins; no wildcard credentials.</summary>
    public static IServiceCollection AddPakpostCors(
        this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

        services.AddCors(options =>
            options.AddPolicy("Frontend", policy =>
                policy.WithOrigins(origins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .WithExposedHeaders("X-Request-ID", "Retry-After")));

        return services;
    }
}
