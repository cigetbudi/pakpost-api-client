using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ISavedRequestRepository
{
    Task<SavedRequest?> FindAsync(Guid id, CancellationToken ct);
    Task<SavedRequest?> FindInCollectionAsync(Guid id, Guid collectionId, CancellationToken ct);
    Task<bool> ExistsInCollectionAsync(Guid id, Guid collectionId, CancellationToken ct);
    Task<IReadOnlyList<SavedRequestIndex>> ListIndexAsync(Guid collectionId, CancellationToken ct);
    Task<IReadOnlyList<SavedRequest>> ListAsync(Guid collectionId, CancellationToken ct);
    Task<int> CountExistingAsync(Guid collectionId, IReadOnlyCollection<Guid> requestIds, CancellationToken ct);
    Task<int> DeleteSelectedAsync(
        Guid collectionId,
        IReadOnlyCollection<Guid> requestIds,
        IReadOnlyCollection<Guid> folderIds,
        CancellationToken ct);
    void Add(SavedRequest value);
    void Remove(SavedRequest value);
}
