using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

public static class CloudFolderRules
{
    public static FolderDto ToDto(CollectionFolder folder)
    {
        return new FolderDto(
            folder.Id,
            folder.CollectionId,
            folder.ParentFolderId,
            folder.Name,
            folder.Version);
    }

    public static async Task CheckAccess(
        Guid actor,
        Guid workspace,
        Guid collection,
        bool write,
        IWorkspaceRepository workspaces,
        ICollectionRepository collections,
        CancellationToken cancellationToken)
    {
        await WorkspacePermissions.RequireAsync(
            workspaces,
            workspace,
            actor,
            write ? WorkspacePermissions.CollectionWrite : WorkspacePermissions.CollectionRead,
            cancellationToken);

        if (!await collections.ExistsInWorkspaceAsync(collection, workspace, cancellationToken))
        {
            throw AppException.NotFound("Collection not found");
        }
    }

    public static void ValidatePlacement(IReadOnlyList<CollectionFolder> folders, Guid collectionId, Guid? parentId, string name, Guid? selfId = null) =>
        CloudFolderHierarchyPolicy.ValidatePlacement(folders, collectionId, parentId, name, selfId);

    public static void ValidateMove(IReadOnlyList<CollectionFolder> folders, Guid collectionId, Guid? targetParentId, CollectionFolder movingFolder) =>
        CloudFolderHierarchyPolicy.ValidateMove(folders, collectionId, targetParentId, movingFolder);

    public static HashSet<Guid> ValidateTransfer(IReadOnlyList<CollectionFolder> source, IReadOnlyList<CollectionFolder> destination, CollectionFolder moving, Guid targetCollectionId, Guid? targetParentId) =>
        CloudFolderHierarchyPolicy.ValidateTransfer(source, destination, moving, targetCollectionId, targetParentId);

    public static HashSet<Guid> ExpandSubtrees(IReadOnlyList<CollectionFolder> folders, IEnumerable<Guid> rootIds) =>
        CloudFolderHierarchyPolicy.ExpandSubtrees(folders, rootIds);
}
