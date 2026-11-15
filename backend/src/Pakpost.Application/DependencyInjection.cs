using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Pakpost.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Mediator's source generator (in Pakpost.Api) registers handlers.
        // Keep FluentValidation registration in the application layer.
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
        return services;
    }
}
