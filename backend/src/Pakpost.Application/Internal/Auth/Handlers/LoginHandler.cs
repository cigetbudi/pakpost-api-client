using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth;

public sealed class LoginHandler(IUserRepository users, IPasswordHasher passwords, IJwtTokenService tokens)
    : IRequestHandler<LoginCommand, LoginResult>
{
    public async ValueTask<LoginResult> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(cmd.Email.Trim().ToLowerInvariant(), ct);
        // Avoid account enumeration using identical messages.
        if (user is null || !passwords.Verify(cmd.Password, user.PasswordHash))
            throw AppException.Unauthorized("Invalid email or password");
        var (token, seconds) = tokens.CreateToken(user);
        return new(token, seconds, new(user.Id, user.Email, user.DisplayName));
    }
}
