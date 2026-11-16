using System.Security.Cryptography;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth;

public sealed record GoogleLoginCommand(string Credential) : IRequest<LoginResult>;
public sealed record GoogleLinkCommand(Guid UserId, string Credential, string Password) : IRequest<GoogleLinkResult>;
public sealed record GoogleLinkResult(bool Linked);

public sealed class GoogleLoginValidator : AbstractValidator<GoogleLoginCommand>
{
    public GoogleLoginValidator() => RuleFor(x => x.Credential).NotEmpty().MaximumLength(8192);
}
public sealed class GoogleLinkValidator : AbstractValidator<GoogleLinkCommand>
{
    public GoogleLinkValidator()
    {
        RuleFor(x => x.Credential).NotEmpty().MaximumLength(8192);
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class GoogleLoginHandler(
    IUserRepository users, IUserExternalIdentityRepository identities,
    IGoogleIdentityVerifier verifier, IPasswordHasher passwords,
    IJwtTokenService tokens, IUnitOfWork unitOfWork)
    : IRequestHandler<GoogleLoginCommand, LoginResult>
{
    public async ValueTask<LoginResult> Handle(GoogleLoginCommand command, CancellationToken ct)
    {
        var google = await verifier.VerifyAsync(command.Credential, ct);
        var linked = await identities.FindByProviderSubjectAsync("google", google.Subject, ct);
        User user;
        if (linked is not null)
        {
            user = await users.FindByIdAsync(linked.UserId, ct)
                ?? throw AppException.Unauthorized("Linked account not found");
        }
        else
        {
            // Do not silently take over an email/password account by matching email.
            if (await users.FindByEmailAsync(google.Email, ct) is not null)
                throw AppException.Conflict("This email already has a PakPost account. Sign in with password and use Connect Google.");

            // Generate an unguessable local password so Google-only users cannot
            // authenticate with a blank/default password. A password reset flow is future work.
            var randomPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
            user = new User(google.Email, google.DisplayName, passwords.Hash(randomPassword));
            users.Add(user);
            identities.Add(new UserExternalIdentity(user.Id, "google", google.Subject));
            await unitOfWork.SaveChangesAsync(ct);
        }
        var (jwt, expires) = tokens.CreateToken(user);
        return new LoginResult(jwt, expires, new UserProfile(user.Id, user.Email, user.DisplayName));
    }
}

public sealed class GoogleLinkHandler(
    IUserRepository users, IUserExternalIdentityRepository identities,
    IGoogleIdentityVerifier verifier, IPasswordHasher passwords, IUnitOfWork unitOfWork)
    : IRequestHandler<GoogleLinkCommand, GoogleLinkResult>
{
    public async ValueTask<GoogleLinkResult> Handle(GoogleLinkCommand command, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(command.UserId, ct)
            ?? throw AppException.Unauthorized();
        // Re-authenticate with the existing password before linking a new login method.
        if (!passwords.Verify(command.Password, user.PasswordHash))
            throw AppException.Unauthorized("Password confirmation failed");

        var google = await verifier.VerifyAsync(command.Credential, ct);
        if (!string.Equals(google.Email, user.Email, StringComparison.OrdinalIgnoreCase))
            throw AppException.Forbidden("Google email must match the PakPost account email");
        if (await identities.FindByUserProviderAsync(user.Id, "google", ct) is not null ||
            await identities.FindByProviderSubjectAsync("google", google.Subject, ct) is not null)
            throw AppException.Conflict("Google account already connected");

        identities.Add(new UserExternalIdentity(user.Id, "google", google.Subject));
        await unitOfWork.SaveChangesAsync(ct);
        return new GoogleLinkResult(true);
    }
}
