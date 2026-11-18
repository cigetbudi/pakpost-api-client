using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface ISavedRequestRevisionRepository
{
    Task<bool> AnyAsync(Guid requestId, CancellationToken ct);
    Task<IReadOnlyList<SavedRequestRevision>> ListAsync(Guid requestId, int take, CancellationToken ct);
    Task<SavedRequestRevision?> FindAsync(Guid requestId, int revision, CancellationToken ct);
    Task TrimAsync(Guid requestId, int keepExisting, CancellationToken ct);
    void Add(SavedRequestRevision revision);
}
