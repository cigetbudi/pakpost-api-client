using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pakpost.Infrastructure.Extensions;

namespace Pakpost.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddPersistenceServices(configuration);
        services.AddExternalServices();

        return services;
    }
}
