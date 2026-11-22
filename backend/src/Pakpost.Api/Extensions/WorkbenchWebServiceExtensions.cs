using System.Text.Json.Serialization;
using Pakpost.Api.Realtime;

namespace Pakpost.Api.Extensions;

public static class WorkbenchWebServiceExtensions
{
    public static IServiceCollection AddWorkbenchWebServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddControllers().AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        services.AddAuthorization();
        services.AddSignalR();
        services.AddSingleton<WorkspaceConnectionRegistry>();
        services.AddSingleton<IWorkspaceChangePublisher, WorkspaceChangePublisher>();

        services.AddPakpostRateLimiting();
        services.AddPakpostCors(configuration);

        return services;
    }
}
