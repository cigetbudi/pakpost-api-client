using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ICollectionRepository
{
    Task<Collection?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid, int>> CountRequestsAsync(Guid workspaceId, CancellationToken ct);
    void Add(Collection collection);
    void Remove(Collection collection);
}
