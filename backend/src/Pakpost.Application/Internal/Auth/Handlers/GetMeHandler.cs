using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Auth.DTOs;
using Pakpost.Application.Internal.Auth.Queries;

namespace Pakpost.Application.Internal.Auth.Handlers;

public sealed class GetMeHandler(IUserRepository users) : IRequestHandler<GetMeQuery, UserProfile>
{
    public async ValueTask<UserProfile> Handle(GetMeQuery q, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(q.UserId, ct) ?? throw AppException.Unauthorized();
        if (user.IsDisabled) throw AppException.Unauthorized();
        return new(user.Id, user.Email, user.DisplayName, null, user.IsSuperAdmin);
    }
}
