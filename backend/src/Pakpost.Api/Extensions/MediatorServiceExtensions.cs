using Pakpost.Application.Internal.Auth.Commands;
using Mediator;
using Pakpost.Application.Common.Behaviors;

namespace Pakpost.Api.Extensions;

public static class MediatorServiceExtensions
{
    public static IServiceCollection AddMediatorServices(this IServiceCollection services)
    {
        services.AddMediator((MediatorOptions options) =>
        {
            options.Assemblies = [typeof(RegisterCommand)];
            options.ServiceLifetime = ServiceLifetime.Scoped;
            options.PipelineBehaviors = [typeof(ValidationBehavior<,>)];
        });

        return services;
    }
}
