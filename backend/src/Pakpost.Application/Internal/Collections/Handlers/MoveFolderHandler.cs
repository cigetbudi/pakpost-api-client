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
    IUnitOfWork unitOfWork)
    : IRequestHandler<MoveFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(MoveFolderCommand command, CancellationToken cancellationToken)
    {
        await CloudFolderRules.CheckAccess(
            command.ActorId,
            command.WorkspaceId,
            command.CollectionId,
            true,
            workspaces,
            collections,
            cancellationToken);

        var folder = await folders.FindAsync(command.FolderId, cancellationToken);

        if (folder is null || folder.CollectionId != command.CollectionId)
        {
            throw AppException.NotFound("Folder not found");
        }

        if (command.ExpectedVersion <= 0 || folder.Version != command.ExpectedVersion)
        {
            throw AppException.Conflict("Folder changed: reload first");
        }

        var siblings = await folders.ListAsync(command.CollectionId, cancellationToken);

        CloudFolderRules.ValidateMove(
            siblings,
            command.CollectionId,
            command.TargetParentId,
            folder);

        folder.Move(command.TargetParentId);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return CloudFolderRules.ToDto(folder);
    }
}
