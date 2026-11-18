using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ISavedRequestRepository
{
    Task<SavedRequest?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<SavedRequest>> ListAsync(Guid collectionId, CancellationToken ct);
    void Add(SavedRequest value);
    void Remove(SavedRequest value);
}
