using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ICollectionRepository
{
    Task<Collection?> FindAsync(Guid id, CancellationToken ct);
    Task<bool> ExistsInWorkspaceAsync(Guid collectionId, Guid workspaceId, CancellationToken ct);
    Task<IReadOnlyList<CollectionOverview>> ListOverviewAsync(Guid workspaceId, CancellationToken ct);
    Task<IReadOnlyList<Collection>> ListAsync(Guid workspaceId, CancellationToken ct);
    // Tracked and un-decrypted: organization changes never need collection secrets.
    Task<IReadOnlyList<Collection>> ListForOrganizationAsync(Guid workspaceId, CancellationToken ct);
    Task<bool> HasChildrenAsync(Guid workspaceId, Guid collectionId, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid, int>> CountRequestsAsync(Guid workspaceId, CancellationToken ct);
    void Add(Collection collection);
    void Remove(Collection collection);
}
