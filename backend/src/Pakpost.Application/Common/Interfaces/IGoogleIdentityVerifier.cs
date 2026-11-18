using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IGoogleIdentityVerifier
{
    Task<GoogleIdentity> VerifyAsync(string idToken, CancellationToken ct);
}
