using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Infrastructure.Persistence.Repositories;

public sealed class SavedRequestRepository(PakpostDbContext db) : ISavedRequestRepository
{
    public async Task<SavedRequest?> FindAsync(Guid id, CancellationToken ct)
    {
        var request = await db.SavedRequests.FirstOrDefaultAsync(item => item.Id == id, ct);

        if (request is not null)
        {
            var workspaceId = await db.WorkspaceForCollectionAsync(request.CollectionId, ct);
            await db.DecryptRequestAsync(request, workspaceId, ct);
        }

        return request;
    }

    public async Task<IReadOnlyList<SavedRequest>> ListAsync(Guid collectionId, CancellationToken ct)
    {
        var requests = await db.SavedRequests
            .AsNoTracking()
            .Where(request => request.CollectionId == collectionId)
            .OrderBy(request => request.Name)
            .ToListAsync(ct);

        if (requests.Count == 0)
        {
            return requests;
        }

        var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);

        foreach (var request in requests)
        {
            await db.DecryptRequestAsync(request, workspaceId, ct);
        }

        return requests;
    }

    public void Add(SavedRequest request) => db.SavedRequests.Add(request);

    public void Remove(SavedRequest request) => db.SavedRequests.Remove(request);
}
