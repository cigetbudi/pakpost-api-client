using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth;

public sealed class GetMeHandler(IUserRepository users) : IRequestHandler<GetMeQuery, UserProfile>
{
    public async ValueTask<UserProfile> Handle(GetMeQuery q, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(q.UserId, ct) ?? throw AppException.Unauthorized();
        return new(user.Id, user.Email, user.DisplayName);
    }
}
