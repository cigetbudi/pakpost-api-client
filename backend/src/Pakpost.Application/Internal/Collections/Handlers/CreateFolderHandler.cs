using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class CreateFolderHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ICollectionFolderRepository folders,
    IUnitOfWork unitOfWork,
    ITransactionManager transactions)
    : IRequestHandler<CreateFolderCommand, FolderDto>
{
    public async ValueTask<FolderDto> Handle(CreateFolderCommand command, CancellationToken ct)
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

        var existing = await folders.ListAsync(command.CollectionId, ct);

        CloudFolderRules.ValidatePlacement(
            existing,
            command.CollectionId,
            command.ParentFolderId,
            command.Name);

        var folder = new CollectionFolder(
            command.CollectionId,
            command.ParentFolderId,
            command.Name);

        folders.Add(folder);

        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return CloudFolderRules.ToDto(folder);
    }
}
