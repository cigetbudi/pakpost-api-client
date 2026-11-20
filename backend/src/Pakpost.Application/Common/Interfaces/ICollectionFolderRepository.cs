using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ICollectionFolderRepository
{
    Task<CollectionFolder?> FindAsync(Guid folderId, CancellationToken ct);
    Task<IReadOnlyList<CollectionFolder>> ListAsync(Guid collectionId, CancellationToken ct);
    Task<IReadOnlyList<CollectionFolder>> ListTrackedAsync(Guid collectionId, CancellationToken ct);
    Task<bool> HasRequestsAsync(Guid folderId, CancellationToken ct);
    void Add(CollectionFolder folder);
    void Remove(CollectionFolder folder);
}
