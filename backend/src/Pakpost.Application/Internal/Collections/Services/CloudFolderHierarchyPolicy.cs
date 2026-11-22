using Pakpost.Application.Common.Exceptions;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

// Domain-only hierarchy guard. The public CloudFolderRules facade remains the entry point.
internal static class CloudFolderHierarchyPolicy
{
    private const int MaximumDepth = 24;
    private const int MaximumFolders = 500;
    public static void ValidatePlacement(
        IReadOnlyList<CollectionFolder> folders,
        Guid collectionId,
        Guid? parentId,
        string name,
        Guid? selfId = null)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 120)
        {
            throw AppException.BadRequest("Folder name must be 1-120 characters");
        }

        if (folders.Count >= MaximumFolders && selfId is null)
        {
            throw AppException.BadRequest("Folder limit: 500 per collection");
        }

        var parentDepth = GetParentDepth(folders, collectionId, parentId, selfId);

        if (selfId is null && parentDepth >= MaximumDepth)
        {
            throw AppException.BadRequest("Folder depth or cycle not allowed");
        }

        if (folders.Any(folder =>
            folder.Id != selfId &&
            folder.ParentFolderId == parentId &&
            string.Equals(folder.Name, name.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            throw AppException.Conflict("A folder with this name already exists under the same parent");
        }
    }

    public static void ValidateMove(
        IReadOnlyList<CollectionFolder> folders,
        Guid collectionId,
        Guid? targetParentId,
        CollectionFolder movingFolder)
    {
        ValidatePlacement(
            folders,
            collectionId,
            targetParentId,
            movingFolder.Name,
            movingFolder.Id);

        var parentDepth = GetParentDepth(folders, collectionId, targetParentId, movingFolder.Id);
        var byParent = folders.ToLookup(folder => folder.ParentFolderId);
        var visiting = new HashSet<Guid>();

        int MeasureSubtree(Guid folderId)
        {
            if (!visiting.Add(folderId))
            {
                throw AppException.BadRequest("Invalid cyclic folder tree");
            }

            var depth = 1;

            foreach (var child in byParent[folderId])
            {
                depth = Math.Max(depth, 1 + MeasureSubtree(child.Id));
            }

            visiting.Remove(folderId);
            return depth;
        }

        if (parentDepth + MeasureSubtree(movingFolder.Id) > MaximumDepth)
        {
            throw AppException.BadRequest("Folder subtree would exceed maximum depth");
        }
    }

    public static HashSet<Guid> ValidateTransfer(
        IReadOnlyList<CollectionFolder> source,
        IReadOnlyList<CollectionFolder> destination,
        CollectionFolder moving,
        Guid targetCollectionId,
        Guid? targetParentId)
    {
        var selected = ExpandSubtrees(source, new[] { moving.Id });
        if (destination.Count + selected.Count > MaximumFolders)
            throw AppException.BadRequest("Target collection folder limit exceeded");
        ValidatePlacement(destination, targetCollectionId, targetParentId, moving.Name);
        var byId = source.ToDictionary(item => item.Id);
        var maxSubtreeDepth = 1;
        foreach (var id in selected)
        {
            var depth = 1;
            var visited = new HashSet<Guid>();
            var current = byId[id].ParentFolderId;
            while (current is Guid parentId && selected.Contains(parentId))
            {
                if (!visited.Add(parentId)) throw AppException.Conflict("Invalid folder cycle");
                depth++;
                current = byId[parentId].ParentFolderId;
            }
            maxSubtreeDepth = Math.Max(maxSubtreeDepth, depth);
        }
        var destinationDepth = GetParentDepth(destination, targetCollectionId, targetParentId, null);
        if (destinationDepth + maxSubtreeDepth > MaximumDepth)
            throw AppException.BadRequest("Folder subtree would exceed maximum depth");
        return selected;
    }

    public static HashSet<Guid> ExpandSubtrees(
        IReadOnlyList<CollectionFolder> folders,
        IEnumerable<Guid> rootIds)
    {
        var byParent = folders.ToLookup(folder => folder.ParentFolderId);
        var expanded = new HashSet<Guid>();
        var visiting = new HashSet<Guid>();

        void Visit(Guid folderId)
        {
            if (!visiting.Add(folderId))
            {
                throw AppException.Conflict("Invalid cyclic folder hierarchy");
            }

            if (expanded.Add(folderId))
            {
                foreach (var child in byParent[folderId])
                {
                    Visit(child.Id);
                }
            }

            visiting.Remove(folderId);
        }

        foreach (var rootId in rootIds)
        {
            if (!expanded.Contains(rootId))
            {
                Visit(rootId);
            }
        }

        return expanded;
    }

    private static int GetParentDepth(
        IReadOnlyList<CollectionFolder> folders,
        Guid collectionId,
        Guid? parentId,
        Guid? selfId)
    {
        var byId = folders.ToDictionary(folder => folder.Id);
        var visited = new HashSet<Guid>();
        var depth = 0;

        while (parentId is Guid id)
        {
            if (!visited.Add(id) || id == selfId || ++depth > MaximumDepth)
            {
                throw AppException.BadRequest("Folder depth or cycle not allowed");
            }

            if (!byId.TryGetValue(id, out var parent) || parent.CollectionId != collectionId)
            {
                throw AppException.BadRequest("Parent folder must belong to this collection");
            }

            parentId = parent.ParentFolderId;
        }

        return depth;
    }
}
