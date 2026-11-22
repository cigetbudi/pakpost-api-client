using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Pakpost.Application.Common.Interfaces;

namespace Pakpost.Infrastructure.Persistence.Repositories;

// Read-only index queries live here: do not fetch body/scripts or decrypt into SQL.
// The repository still owns the public contract and exposes only authorized callers.
internal static class SavedRequestIndexReader
{
    public static async Task<IReadOnlyList<SavedRequestIndex>> ListIndexAsync(PakpostDbContext db, Guid collectionId, CancellationToken ct)
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

    public static async Task<SavedRequestIndexPage> PageIndexAsync(
        PakpostDbContext db, Guid collectionId, int size, Guid? afterId, string? afterName, string? search,
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

}
