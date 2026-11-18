using System.Security.Cryptography;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Auth.Commands;
using Pakpost.Application.Internal.Auth.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth.Handlers;

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
