using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Application.Internal.Auth;
public sealed record UserProfile(Guid Id, string Email, string DisplayName);
public sealed record LoginResult(string AccessToken, int ExpiresInSeconds, UserProfile User);
public sealed record RegisterCommand(string Email, string Password, string DisplayName) : IRequest<LoginResult>;
public sealed record LoginCommand(string Email, string Password) : IRequest<LoginResult>;
public sealed record GetMeQuery(Guid UserId) : IRequest<UserProfile>;
public sealed class RegisterValidator : AbstractValidator<RegisterCommand>
{
    public RegisterValidator()
    {
        RuleFor(x=>x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x=>x.Password).NotEmpty().MinimumLength(12).MaximumLength(128);
        RuleFor(x=>x.DisplayName).NotEmpty().MaximumLength(120);
    }
}
public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x=>x.Email).NotEmpty().EmailAddress();
        RuleFor(x=>x.Password).NotEmpty();
    }
}
public sealed class RegisterHandler(IUserRepository users, IPasswordHasher passwords, IJwtTokenService tokens, IUnitOfWork uow)
    : IRequestHandler<RegisterCommand, LoginResult>
{
    public async ValueTask<LoginResult> Handle(RegisterCommand cmd, CancellationToken ct)
    {
        var email = cmd.Email.Trim().ToLowerInvariant();
        if (await users.FindByEmailAsync(email,ct) is not null) throw AppException.Conflict("Email already registered");
        var user = new User(email, cmd.DisplayName, passwords.Hash(cmd.Password));
        users.Add(user);
        await uow.SaveChangesAsync(ct);
        var (token, seconds) = tokens.CreateToken(user);
        return new(token, seconds, new(user.Id,user.Email,user.DisplayName));
    }
}
public sealed class LoginHandler(IUserRepository users, IPasswordHasher passwords, IJwtTokenService tokens)
    : IRequestHandler<LoginCommand, LoginResult>
{
    public async ValueTask<LoginResult> Handle(LoginCommand cmd, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(cmd.Email.Trim().ToLowerInvariant(),ct);
        // Avoid account enumeration using identical messages.
        if (user is null || !passwords.Verify(cmd.Password, user.PasswordHash))
            throw AppException.Unauthorized("Invalid email or password");
        var (token,seconds) = tokens.CreateToken(user);
        return new(token, seconds, new(user.Id,user.Email,user.DisplayName));
    }
}
public sealed class GetMeHandler(IUserRepository users) : IRequestHandler<GetMeQuery, UserProfile>
{
    public async ValueTask<UserProfile> Handle(GetMeQuery q,CancellationToken ct)
    {
        var user=await users.FindByIdAsync(q.UserId,ct) ?? throw AppException.Unauthorized();
        return new(user.Id,user.Email,user.DisplayName);
    }
}
