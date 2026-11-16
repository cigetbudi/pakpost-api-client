using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;
public sealed class UserExternalIdentityRepository(PakpostDbContext db) : IUserExternalIdentityRepository
{
    public Task<UserExternalIdentity?> FindByProviderSubjectAsync(string provider, string subject, CancellationToken ct)
        => db.UserExternalIdentities.FirstOrDefaultAsync(x => x.Provider == provider && x.Subject == subject, ct);
    public Task<UserExternalIdentity?> FindByUserProviderAsync(Guid userId, string provider, CancellationToken ct)
        => db.UserExternalIdentities.FirstOrDefaultAsync(x => x.UserId == userId && x.Provider == provider, ct);
    public void Add(UserExternalIdentity identity) => db.UserExternalIdentities.Add(identity);
}
