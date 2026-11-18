using Mediator;
using Pakpost.Application.Common.Behaviors;
using Pakpost.Application.Internal.Auth;

namespace Pakpost.Api.Extensions;

/// <summary>
/// Keep Mediator's source-generator registration in the executable assembly.
/// Retains PakPost's existing scoped handlers and validation pipeline.
/// </summary>
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
