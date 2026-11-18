using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IUserExternalIdentityRepository
{
    Task<UserExternalIdentity?> FindByProviderSubjectAsync(string provider, string subject, CancellationToken ct);
    Task<UserExternalIdentity?> FindByUserProviderAsync(Guid userId, string provider, CancellationToken ct);
    void Add(UserExternalIdentity identity);
}
