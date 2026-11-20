using System.Text;
using System.Text.Json;
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
            .OrderBy(request => request.SortOrder).ThenBy(request => request.Id)
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

    public async Task<SavedRequestIndexPage> PageIndexAsync(
        Guid collectionId, int size, Guid? afterId, string? afterName, string? search,
        Guid? folderId, bool rootOnly, bool sortByName, CancellationToken ct)
    {
        // PostgreSQL supports UUID range comparison; LINQ Guid.CompareTo
        // translation varies by EF provider, so keep the UUID seek in SQL.
        // The outer projection selects only index fields, never Body/Scripts.
        var after = afterId ?? Guid.Empty;
        var query = sortByName
            ? db.SavedRequests.FromSqlInterpolated(
                $"SELECT * FROM collection.saved_requests WHERE \"CollectionId\" = {collectionId} AND (\"Name\", \"Id\") > ({afterName ?? string.Empty}, {after})").AsNoTracking()
            : db.SavedRequests.AsNoTracking().Where(item => item.CollectionId == collectionId);
        if (!sortByName && afterId is Guid previous)
        {
            var priorOrder = await db.SavedRequests.AsNoTracking()
                .Where(item => item.Id == previous && item.CollectionId == collectionId)
                .Select(item => (int?)item.SortOrder).SingleOrDefaultAsync(ct);
            if (priorOrder is null) return new SavedRequestIndexPage([], null, false);
            query = db.SavedRequests.FromSqlInterpolated(
                $"SELECT * FROM collection.saved_requests WHERE \"CollectionId\" = {collectionId} AND (\"sort_order\", \"Id\") > ({priorOrder.Value}, {previous})").AsNoTracking();
        }
        if (folderId.HasValue) query = query.Where(item => item.FolderId == folderId);
        else if (rootOnly) query = query.Where(item => item.FolderId == null);
        if (!string.IsNullOrWhiteSpace(search))
        {
            // Request name is non-secret metadata. URL and headers are encrypted
            // and must not be sent to a search index in plaintext.
            var escaped = search.Replace("\\", "\\\\")
                .Replace("%", "\\%").Replace("_", "\\_");
            query = query.Where(item => EF.Functions.ILike(item.Name, $"%{escaped}%", "\\"));
        }
        var sorted = sortByName ? query.OrderBy(item => item.Name).ThenBy(item => item.Id)
            : query.OrderBy(item => item.SortOrder).ThenBy(item => item.Id);
        var rows = await sorted.Take(size + 1)
            .Select(item => new SavedRequestIndex(item.Id, item.CollectionId,
                item.FolderId, item.Revision, item.Name, item.Method,
                item.Url, item.HeadersJson))
            .ToListAsync(ct);
        var hasMore = rows.Count > size;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        if (rows.Count == 0) return new SavedRequestIndexPage(rows, null, false);
        var workspaceId = await db.WorkspaceForCollectionAsync(collectionId, ct);
        var result = new SavedRequestIndex[rows.Count];
        for (var i = 0; i < rows.Count; i++)
        {
            var (url, headers) = await db.DecryptRequestIndexAsync(
                workspaceId, rows[i].Id, rows[i].Url, rows[i].HeadersJson, ct);
            result[i] = rows[i] with { Url = url, HeadersJson = headers };
        }
        string? next = null;
        if (hasMore)
        {
            next = sortByName
                ? Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(
                    new[] { rows[^1].Name, rows[^1].Id.ToString("N") })))
                    .TrimEnd('=').Replace('+', '-').Replace('/', '_')
                : rows[^1].Id.ToString("N");
        }
        return new SavedRequestIndexPage(result, next, hasMore);
    }

    public async Task<IReadOnlyList<SavedRequest>> ListAsync(Guid collectionId, CancellationToken ct)
    {
        var requests = await db.SavedRequests
            .AsNoTracking()
            .Where(request => request.CollectionId == collectionId)
            .OrderBy(request => request.SortOrder).ThenBy(request => request.Id)
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

    public async Task<IReadOnlyList<MovedFolderRequestReference>> ListFolderRequestReferencesAsync(
        Guid sourceCollectionId, IReadOnlyCollection<Guid> folderIds, CancellationToken ct)
    {
        var ids=folderIds.ToArray();
        return await db.SavedRequests.AsNoTracking()
            .Where(request => request.CollectionId == sourceCollectionId &&
                request.FolderId.HasValue && ids.Contains(request.FolderId.Value))
            .Select(request => new MovedFolderRequestReference(request.Id,request.Revision))
            .ToListAsync(ct);
    }

    public Task<int> MoveFolderRequestsAsync(Guid sourceCollectionId, Guid targetCollectionId,
        IReadOnlyCollection<Guid> folderIds, CancellationToken ct)
    {
        var ids = folderIds.ToArray();
        if (ids.Length == 0) return Task.FromResult(0);
        // Updating only metadata preserves encrypted content, IDs and revision history.
        // The caller holds a serializable transaction and has checked both collection permissions.
        return db.SavedRequests.Where(request => request.CollectionId == sourceCollectionId &&
                request.FolderId.HasValue && ids.Contains(request.FolderId.Value))
            .ExecuteUpdateAsync(update => update
                .SetProperty(request => request.CollectionId, targetCollectionId)
                .SetProperty(request => request.Revision, request => request.Revision + 1)
                .SetProperty(request => request.UpdatedAt, DateTimeOffset.UtcNow), ct);
    }

    public async Task<IReadOnlyList<SavedRequest>> ListForReorderAsync(
        Guid collectionId, Guid? folderId, CancellationToken ct) =>
        await db.SavedRequests.Where(request => request.CollectionId == collectionId &&
            request.FolderId == folderId).OrderBy(request => request.SortOrder)
            .ThenBy(request => request.Id).ToListAsync(ct);

    public void Add(SavedRequest request) => db.SavedRequests.Add(request);

    public void Remove(SavedRequest request) => db.SavedRequests.Remove(request);
}
