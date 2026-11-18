using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IUserRepository
{
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct);

    Task<User?> FindByEmailAsync(string email, CancellationToken ct);

    Task<IReadOnlyList<User>> FindByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);

    void Add(User user);
}
