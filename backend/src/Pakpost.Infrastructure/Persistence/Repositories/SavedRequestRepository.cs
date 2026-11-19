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

    public Task<bool> ExistsInCollectionAsync(Guid id, Guid collectionId, CancellationToken ct) =>
        db.SavedRequests.AsNoTracking()
            .AnyAsync(item => item.Id == id && item.CollectionId == collectionId, ct);

    public async Task<SavedRequest?> FindInCollectionAsync(Guid id, Guid collectionId, CancellationToken ct)
    {
        var request = await db.SavedRequests.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.CollectionId == collectionId, ct);

        if (request is not null)
        {
            var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);
            await db.DecryptRequestAsync(request, workspaceId, ct);
        }

        return request;
    }

    public async Task<IReadOnlyList<SavedRequestIndex>> ListIndexAsync(Guid collectionId, CancellationToken ct)
    {
        var items = await db.SavedRequests.AsNoTracking()
            .Where(request => request.CollectionId == collectionId)
            .OrderBy(request => request.Name)
            .Select(request => new SavedRequestIndex(
                request.Id,
                request.CollectionId,
                request.FolderId,
                request.Revision,
                request.Name,
                request.Method,
                request.Url,
                request.HeadersJson))
            .ToListAsync(ct);

        if (items.Count == 0)
        {
            return items;
        }

        var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);
        var result = new SavedRequestIndex[items.Count];

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            var (url, headers) = await db.DecryptRequestIndexAsync(
                workspaceId, item.Id, item.Url, item.HeadersJson, ct);
            result[i] = item with { Url = url, HeadersJson = headers };
        }

        return result;
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

    public Task<int> CountExistingAsync(
        Guid collectionId,
        IReadOnlyCollection<Guid> requestIds,
        CancellationToken ct)
    {
        if (requestIds.Count == 0)
        {
            return Task.FromResult(0);
        }

        var ids = requestIds.ToArray();
        return db.SavedRequests.CountAsync(
            request => request.CollectionId == collectionId && ids.Contains(request.Id), ct);
    }

    public Task<int> DeleteSelectedAsync(
        Guid collectionId,
        IReadOnlyCollection<Guid> requestIds,
        IReadOnlyCollection<Guid> folderIds,
        CancellationToken ct)
    {
        if (requestIds.Count == 0 && folderIds.Count == 0)
        {
            return Task.FromResult(0);
        }

        var ids = requestIds.ToArray();
        var folders = folderIds.ToArray();

        return db.SavedRequests
            .Where(request => request.CollectionId == collectionId &&
                (ids.Contains(request.Id) ||
                 (request.FolderId.HasValue && folders.Contains(request.FolderId.Value))))
            .ExecuteDeleteAsync(ct);
    }

    public void Add(SavedRequest request) => db.SavedRequests.Add(request);

    public void Remove(SavedRequest request) => db.SavedRequests.Remove(request);
}
