using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class MoveFolderHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ICollectionFolderRepository folders,
    IUnitOfWork unitOfWork,
    ITransactionManager transactions,
    ISavedRequestRepository requests)
    : IRequestHandler<MoveFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(MoveFolderCommand command, CancellationToken ct)
    {
        await using var transaction = await transactions.BeginSerializableAsync(ct);

        await CloudFolderRules.CheckAccess(
            command.ActorId,
            command.WorkspaceId,
            command.CollectionId,
            true,
            workspaces,
            collections,
            ct);

        var folder = await folders.FindAsync(command.FolderId, ct);

        if (folder is null || folder.CollectionId != command.CollectionId)
        {
            throw AppException.NotFound("Folder not found");
        }

        if (command.ExpectedVersion <= 0 || folder.Version != command.ExpectedVersion)
        {
            throw AppException.Conflict("Folder changed: reload first");
        }

        IReadOnlyList<MovedFolderRequest>? movedRequests = null;
        var targetCollectionId = command.TargetCollectionId ?? command.CollectionId;
        if (targetCollectionId == command.CollectionId)
        {
            var siblings = await folders.ListAsync(command.CollectionId, ct);
            CloudFolderRules.ValidateMove(siblings, command.CollectionId,
                command.TargetParentId, folder);
            folder.Move(command.TargetParentId);
        }
        else
        {
            // Both collections must belong to this workspace; do not allow cross-workspace moves.
            await CloudFolderRules.CheckAccess(command.ActorId, command.WorkspaceId,
                targetCollectionId, true, workspaces, collections, ct);
            var original = await folders.ListAsync(command.CollectionId, ct);
            var destination = await folders.ListAsync(targetCollectionId, ct);
            var subtree = CloudFolderRules.ValidateTransfer(original, destination,
                folder, targetCollectionId, command.TargetParentId);
            // Load all source folders tracked once, then move the selected subtree in place.
            // References between descendants keep their original stable GUIDs.
            var tracked = await folders.ListTrackedAsync(command.CollectionId, ct);
            foreach (var child in tracked.Where(item => subtree.Contains(item.Id)))
            {
                child.Rehome(targetCollectionId,
                    child.Id == folder.Id ? command.TargetParentId : child.ParentFolderId);
            }
            // Only IDs/revisions are projected: never send encrypted request content.
            var references = await requests.ListFolderRequestReferencesAsync(
                command.CollectionId, subtree, ct);
            movedRequests = references.Select(request =>
                new MovedFolderRequest(request.Id, request.Revision + 1)).ToArray();
            // ExecuteUpdate runs within the same serializable database transaction.
            // Encrypted request payloads remain encrypted under the same workspace key.
            await requests.MoveFolderRequestsAsync(command.CollectionId,
                targetCollectionId, subtree, ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return CloudFolderRules.ToDto(folder) with { MovedRequests = movedRequests };
    }
}
