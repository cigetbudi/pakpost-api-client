using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class RenameFolderHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ICollectionFolderRepository folders,
    IUnitOfWork unitOfWork,
    ITransactionManager transactions)
    : IRequestHandler<RenameFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(RenameFolderCommand command, CancellationToken ct)
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

        var siblings = await folders.ListAsync(command.CollectionId, ct);

        CloudFolderRules.ValidatePlacement(
            siblings,
            command.CollectionId,
            folder.ParentFolderId,
            command.Name,
            folder.Id);

        folder.Rename(command.Name);

        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return CloudFolderRules.ToDto(folder);
    }
}
