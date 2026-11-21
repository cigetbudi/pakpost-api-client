using Microsoft.Extensions.DependencyInjection;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Requests.Interfaces;
using Pakpost.Infrastructure.Services;

namespace Pakpost.Infrastructure.Extensions;

public static class ExternalServiceExtensions
{
    public static IServiceCollection AddExternalServices(this IServiceCollection services)
    {
        services.AddSingleton<IGoogleIdentityVerifier, GoogleIdentityVerifier>();
        services.AddScoped<IWorkspaceInvitationEmailSender, SmtpWorkspaceInvitationEmailSender>();
        services.AddScoped<IPlatformCreatorInvitationEmailSender, SmtpPlatformCreatorInvitationEmailSender>();
        services.AddSingleton<IEnvironmentValueCipher, EnvironmentValueCipher>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddTransient<IHttpRequestRunner, SafeHttpRequestRunner>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();

        return services;
    }
}
