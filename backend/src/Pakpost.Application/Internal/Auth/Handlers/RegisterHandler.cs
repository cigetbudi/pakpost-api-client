using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Auth.Commands;
using Pakpost.Application.Internal.Auth.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth.Handlers;

public sealed class RegisterHandler(IUserRepository users, IPasswordHasher passwords, IJwtTokenService tokens, IUnitOfWork uow)
    : IRequestHandler<RegisterCommand, LoginResult>
{
    public async ValueTask<LoginResult> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        var email = cmd.Email.Trim().ToLowerInvariant();
        if (await users.FindByEmailAsync(email, ct) is not null)
            throw AppException.Conflict("Email already registered");
        var user = new User(email, cmd.DisplayName, passwords.Hash(cmd.Password));
        users.Add(user);
        await uow.SaveChangesAsync(ct);
        var (token, seconds) = tokens.CreateToken(user);
        return new(token, seconds, new(user.Id, user.Email, user.DisplayName));
    }
}
