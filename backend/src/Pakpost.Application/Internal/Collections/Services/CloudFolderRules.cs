using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

public static class CloudFolderRules
{
    public static FolderDto ToDto(CollectionFolder f) => new(f.Id, f.CollectionId, f.ParentFolderId, f.Name, f.Version);
    public static async Task CheckAccess(Guid actor, Guid workspace, Guid collection, bool write,
        IWorkspaceRepository workspaces, ICollectionRepository collections, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, workspace, actor,
            write?WorkspacePermissions.CollectionWrite:WorkspacePermissions.CollectionRead, ct);
        var col = await collections.FindAsync(collection, ct);
        if (col is null || col.WorkspaceId != workspace)
            throw AppException.NotFound("Collection not found");
    }
    public static void ValidatePlacement(IReadOnlyList<CollectionFolder> list, Guid collection, Guid? parent, string name,
        Guid? self = null)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length>120)
            throw AppException.BadRequest("Folder name must be 1-120 characters");
        if (list.Count >= 500 && self is null)
            throw AppException.BadRequest("Folder limit: 500 per collection");
        var map = list.ToDictionary(f => f.Id);
        var level = 0;
        var current = parent;
        while (current is Guid id)
        {
            if (++level>24 || id == self)
                throw AppException.BadRequest("Folder depth or cycle not allowed");
            if (!map.TryGetValue(id, out var f) || f.CollectionId != collection)
                throw AppException.BadRequest("Parent folder must belong to this collection");
            current = f.ParentFolderId;
        }
        if (list.Any(f => f.Id != self && f.ParentFolderId == parent &&
            string.Equals(f.Name, name.Trim(), StringComparison.OrdinalIgnoreCase)))
        throw AppException.Conflict("A folder with this name already exists under the same parent");
    }
}
