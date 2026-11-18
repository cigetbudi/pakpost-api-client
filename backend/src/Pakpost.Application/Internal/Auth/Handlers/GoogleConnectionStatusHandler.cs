using System.Security.Cryptography;
using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Auth.DTOs;
using Pakpost.Application.Internal.Auth.Queries;

namespace Pakpost.Application.Internal.Auth.Handlers;

public sealed class GoogleConnectionStatusHandler(IUserExternalIdentityRepository identities)
    : IRequestHandler<GoogleConnectionStatusQuery, GoogleConnectionStatus>
{
    public async ValueTask<GoogleConnectionStatus> Handle(GoogleConnectionStatusQuery q, CancellationToken ct)
    => new(await identities.FindByUserProviderAsync(q.UserId, "google", ct) is not null);
}
