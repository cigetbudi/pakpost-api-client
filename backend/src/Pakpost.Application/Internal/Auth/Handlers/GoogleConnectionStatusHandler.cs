using System.Security.Cryptography;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth;

public sealed class GoogleConnectionStatusHandler(IUserExternalIdentityRepository identities)
    : IRequestHandler<GoogleConnectionStatusQuery, GoogleConnectionStatus>
{
    public async ValueTask<GoogleConnectionStatus> Handle(GoogleConnectionStatusQuery q, CancellationToken ct)
    => new(await identities.FindByUserProviderAsync(q.UserId, "google", ct) is not null);
}
