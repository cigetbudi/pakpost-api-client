using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class SavedRequestRepository(PakpostDbContext db) : ISavedRequestRepository
{
    public Task<SavedRequest?> FindAsync(Guid id, CancellationToken ct) =>
        db.SavedRequests.FirstOrDefaultAsync(request => request.Id == id, ct);

    public async Task<IReadOnlyList<SavedRequest>> ListAsync(Guid id, CancellationToken ct) =>
        await db.SavedRequests
            .AsNoTracking()
            .Where(request => request.CollectionId == id)
            .OrderBy(request => request.Name)
            .ToListAsync(ct);

    public void Add(SavedRequest request) => db.SavedRequests.Add(request);

    public void Remove(SavedRequest request) => db.SavedRequests.Remove(request);
}
