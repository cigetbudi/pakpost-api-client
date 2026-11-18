using System.Security.Cryptography;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Auth.Commands;
using Pakpost.Application.Internal.Auth.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth.Handlers;

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
